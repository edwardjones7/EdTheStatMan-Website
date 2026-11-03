import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAccess } from '@/lib/access'
import { TRIAL_DAYS } from '@/lib/offer'

/**
 * Start the Research Desk free trial.
 *
 * No card, no Stripe, nothing to cancel: it writes the pass slot for
 * TRIAL_DAYS and the pass runs out on its own (lib/trial.ts). One per account,
 * enforced by desk_trial_ends_at being set once and never cleared, and by the
 * conditional update below so two clicks cannot both win.
 *
 * Refused for:
 *   - an unconfirmed email. A trial per throwaway address is the one way to
 *     farm free weeks; a confirmed address (or Google sign-in, which arrives
 *     confirmed) makes each one cost a real inbox.
 *   - anyone already holding paid access, or an admin. The trial is for people
 *     deciding whether to buy, and writing the pass slot over a paid pass would
 *     take away what they bought.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to start your free trial.' }, { status: 401 })
  if (!user.email_confirmed_at) {
    return NextResponse.json({ error: 'Confirm your email first. Check your inbox for the link we sent.' }, { status: 403 })
  }

  const admin = createAdminClient() as any
  const { data: profile, error } = await admin
    .from('profiles')
    .select('desk_trial_ends_at, subscription_tier, access_expires_at, is_admin')
    .eq('id', user.id)
    .maybeSingle()

  // Column missing: pricing_01_trial_and_pick_games.sql has not been applied.
  if (error) return NextResponse.json({ error: 'The free trial is not open yet.' }, { status: 503 })
  if (!profile) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })

  if (profile.desk_trial_ends_at) {
    return NextResponse.json({ error: 'You have already used your free trial.' }, { status: 409 })
  }
  if (profile.is_admin || resolveAccess(profile, true).isPaid) {
    return NextResponse.json({ error: 'You already have access.' }, { status: 409 })
  }

  const endsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // `.is(..., null)` makes the claim atomic: the second of two racing clicks
  // matches no row and gets nothing back.
  const { data: claimed, error: upErr } = await admin
    .from('profiles')
    .update({
      desk_trial_ends_at: endsAt,
      pass_tier: 'desk',
      pass_expires_at: endsAt,
      // Written directly as well as through recompute_entitlement, so access
      // opens even if the function were missing.
      subscription_tier: 'desk',
      access_expires_at: endsAt,
    })
    .eq('id', user.id)
    .is('desk_trial_ends_at', null)
    .select('id')
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
  if (!claimed?.length) {
    return NextResponse.json({ error: 'You have already used your free trial.' }, { status: 409 })
  }

  const { error: rpcErr } = await admin.rpc('recompute_entitlement', { p_user: user.id })
  if (rpcErr) console.error(`[trial] recompute_entitlement failed for ${user.id}: ${rpcErr.message}`)

  try {
    await admin.from('events').insert({
      event_type: 'trial_started',
      path: '/api/trial',
      user_id: user.id,
      meta: { tier: 'desk', days: TRIAL_DAYS },
    })
  } catch (e: any) {
    console.error(`[trial] could not record trial_started: ${e?.message}`)
  }

  return NextResponse.json({ ok: true, endsAt, redirect: '/desk/nfl?trial=started' })
}
