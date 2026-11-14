import { withCronLog } from '@/lib/cron-log'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectAll } from '@/lib/supabase/select-all'
import { SEASON_ENDS_AT } from '@/lib/offer'
import { isTrialPass } from '@/lib/trial'
import { passExpiringMessage, passExpiredMessage, sendLifecycleEmail, type LifecycleKind, type LifecycleMessage } from '@/lib/notify/lifecycle'
import { emailLogReady, claimEmail, releaseEmail } from '@/lib/notify/lifecycle-log'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
/** Resend allows ~2 requests/sec; one send per gap stays under it. */
const SEND_GAP_MS = 600

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

interface Row {
  id: string
  email: string | null
  is_admin: boolean | null
  pass_tier: string | null
  pass_expires_at: string | null
  access_expires_at: string | null
  sub_tier: string | null
  subscription_status: string | null
  sub_current_period_end: string | null
  notify_email: boolean | null
  notify_token: string | null
}

const COLS = 'id, email, is_admin, pass_tier, pass_expires_at, access_expires_at, sub_tier, subscription_status, sub_current_period_end, notify_email, notify_token'

/**
 * Mirrors sub_ok in recompute_entitlement() (tier_ladder_03), including the
 * 3-day grace. A member whose subscription carries on past the pass is not
 * losing access, so telling them it "ends" would be wrong.
 */
function subscriptionLive(r: Row, now: number): boolean {
  if (!r.sub_tier || !r.sub_current_period_end) return false
  if (!['active', 'trialing', 'past_due'].includes(r.subscription_status ?? '')) return false
  return now < new Date(r.sub_current_period_end).getTime() + 3 * DAY_MS
}

/**
 * Pass reminders and the one win-back, daily.
 *
 * ONE-TIME PASSES ONLY. A subscription renews on its own and Stripe sends its
 * own receipts; nothing here is about subscriptions.
 *
 * Windows are wider than a day on purpose, with email_log making each send
 * happen once. A daily cron that misses a run (deploy, outage) still catches
 * everyone on the next one, which an exact "expires in 7.0 days" window would
 * not:
 *   7-day   ends in (2d, 7d]   -- floored at 2d so it never lands beside the 1-day
 *   1-day   ends in (0, 30h]
 *   expired ended 3 to 10 days ago, with no access of any kind left
 *
 * ref is the pass_expires_at DATE, so a member who renews (which moves the
 * date) gets reminders for the new one rather than being silenced by the old.
 *
 * ?dry=1 lists what would be sent and sends nothing.
 */
async function run(req: Request) {
  // Same guard as the other crons: Vercel signs its invocations with
  // CRON_SECRET, and without the check anyone could trigger a mail run.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const admin = createAdminClient() as any

  // No guard table, no sends. Without email_log every daily run would mail the
  // same people again, so this waits for the migration rather than improvising.
  if (!(await emailLogReady(admin))) {
    console.warn('[lifecycle] email_log missing; apply supabase/migrations/lifecycle_01_email_log.sql. Skipping.')
    return NextResponse.json({ ok: true, skipped: 'email_log table missing' })
  }

  const now = Date.now()
  const { data: rows, error } = await selectAll<Row>(() => admin
    .from('profiles')
    .select(COLS)
    .not('pass_tier', 'is', null)
    .gte('pass_expires_at', new Date(now - 10 * DAY_MS).toISOString())
    .lte('pass_expires_at', new Date(now + 7 * DAY_MS).toISOString())
    .order('id'))
  if (error) {
    console.error(`[lifecycle] profile read failed: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // A pass ending within a day of SEASON_ENDS_AT is a pre-Nov-2026 season pass
  // reaching its end, so the copy changes and the win-back is skipped. A
  // 365-day pass that happens to end later is not that, hence the window
  // rather than ">=".
  const seasonEndMs = new Date(SEASON_ENDS_AT).getTime()

  // Free-trial markers, read on their own so the cron still runs before
  // pricing_01_trial_and_pick_games.sql is applied (the select just errors).
  const trialEnds = new Map<string, string>()
  {
    const { data: trialRows, error: trialErr } = await admin
      .from('profiles').select('id, desk_trial_ends_at').not('desk_trial_ends_at', 'is', null)
    if (!trialErr) for (const t of trialRows ?? []) trialEnds.set(t.id, t.desk_trial_ends_at)
  }

  const plan: { row: Row; kind: LifecycleKind; ref: string; message: LifecycleMessage }[] = []
  const skipped: Record<string, number> = {}
  const skip = (why: string) => { skipped[why] = (skipped[why] ?? 0) + 1 }

  for (const r of rows) {
    if (!r.email || !r.pass_tier || !r.pass_expires_at) { skip('incomplete'); continue }
    if (r.is_admin) { skip('admin'); continue }
    if (subscriptionLive(r, now)) { skip('subscription continues'); continue }

    const endsMs = new Date(r.pass_expires_at).getTime()
    const left = endsMs - now
    const ref = r.pass_expires_at.slice(0, 10)
    const seasonOver = Math.abs(endsMs - seasonEndMs) <= DAY_MS
    const trial = isTrialPass({ pass_tier: r.pass_tier, pass_expires_at: r.pass_expires_at, desk_trial_ends_at: trialEnds.get(r.id) ?? null })

    // A trial is seven days long, so "a week left" would land the day it starts.
    if (trial && left > 30 * HOUR_MS) { skip('trial running'); continue }

    if (left > 2 * DAY_MS && left <= 7 * DAY_MS) {
      plan.push({ row: r, kind: 'pass_expiring_7d', ref,
        message: passExpiringMessage({ tier: r.pass_tier, expiresAt: r.pass_expires_at, daysLeft: 7, seasonOver }) })
    } else if (left > 0 && left <= 30 * HOUR_MS) {
      plan.push({ row: r, kind: 'pass_expiring_1d', ref,
        message: passExpiringMessage({ tier: r.pass_tier, expiresAt: r.pass_expires_at, daysLeft: 1, seasonOver, trial }) })
    } else if (left <= -3 * DAY_MS) {
      // The win-back is the one sales note here, so it honours the alert
      // toggle and carries an unsubscribe link. access_expires_at is checked
      // as well as the pass: any other live grant means they never left.
      const stillIn = r.access_expires_at && new Date(r.access_expires_at).getTime() > now
      if (stillIn) { skip('other access live'); continue }
      if (seasonOver) { skip('season over'); continue }
      if (r.notify_email === false) { skip('opted out'); continue }
      plan.push({ row: r, kind: 'pass_expired', ref,
        message: passExpiredMessage({ tier: r.pass_tier, expiredAt: r.pass_expires_at, unsubscribeToken: r.notify_token }) })
    } else {
      skip('outside windows')
    }
  }

  if (dry) {
    return NextResponse.json({
      ok: true,
      dry: true,
      wouldSend: plan.map((p) => ({ user: p.row.id, kind: p.kind, ref: p.ref, subject: p.message.subject })),
      skipped,
    })
  }

  const sent: Record<string, number> = {}
  let already = 0
  let failed = 0
  let first = true

  for (const p of plan) {
    const claim = await claimEmail(admin, p.row.id, p.kind, p.ref)
    if (claim === 'already-sent') { already++; continue }
    // The probe passed, so 'unavailable' is a real write failure. Sending
    // without a reservation would repeat tomorrow; skip and let the log say why.
    if (claim === 'unavailable') { failed++; continue }

    if (!first) await sleep(SEND_GAP_MS)
    first = false

    const result = await sendLifecycleEmail(p.row.email, p.message)
    if (result.sent) {
      sent[p.kind] = (sent[p.kind] ?? 0) + 1
    } else {
      failed++
      console.error(`[lifecycle] ${p.kind} to ${p.row.id} failed: ${result.error}`)
      await releaseEmail(admin, p.row.id, p.kind, p.ref)
    }
  }

  const report = { ok: true, candidates: rows.length, sent, already, failed, skipped }
  console.log('[lifecycle] run', JSON.stringify(report))
  return NextResponse.json(report)
}

export const GET = withCronLog('lifecycle', run)
