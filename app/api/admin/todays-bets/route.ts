import { NextResponse } from 'next/server'
import { revalidatePublicPicks } from '@/lib/picks/revalidate'
import { TIER_RANK, normalizeTier, type Tier } from '@/lib/access'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyNewPick } from '@/lib/notify'
import { hasPickEngineColumns } from '@/lib/picks/columns'
import { engineColumnsFromBody } from '@/lib/picks/admin-columns'
import { pickSlug } from '@/lib/picks/slug'
import { gameIdPatch } from '@/lib/picks/game-match'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const admin = createAdminClient()
  const { data: p } = await (admin as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { ok: !!p?.is_admin as boolean, admin: admin as any }
}

/**
 * The gate, plus the pre-v3 pair kept faithfully in step with it.
 *
 * Derived on the server so every client agrees, and derived rather than pinned
 * because lib/notify/audience.ts still reads both flags to decide who hears
 * about a pick: is_elite silences an Edge pick entirely and is_free opens it to
 * the whole list. Pinning is_elite to false — which is right for the Vault
 * tables, where nothing produces it any more — would start notifying every
 * member about picks that are deliberately silent today.
 *
 * min_tier is validated rather than trusted: it is a gate, and an unrecognised
 * value would either bounce off the CHECK constraint as an opaque 500 or read
 * back through normalizeTier as 'retail', publishing a paid pick to everyone.
 */
function accessColumns(body: any): { min_tier: Tier; is_free: boolean; is_elite: boolean } | { error: string } {
  const requested = String(body?.min_tier ?? 'retail')
  if (!(requested in TIER_RANK)) return { error: `Unknown min_tier "${requested}".` }
  const tier = normalizeTier(requested)
  return {
    min_tier: tier,
    is_free: tier === 'retail',
    is_elite: TIER_RANK[tier] > TIER_RANK.portfolio,
  }
}

export async function POST(req: Request) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const access = accessColumns(body)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: 400 })

  // picks_01_engine.sql columns, when they exist: a stable slug (minted now,
  // never recomputed -- lib/picks/slug.ts), the save time, the source, and the
  // price and market if the editor sent them. Before the migration the insert
  // carries none of them and the pick simply has no slug, exactly as today.
  const engine = await hasPickEngineColumns(admin)
  const id = crypto.randomUUID()
  const engineCols = engine
    ? {
        id,
        slug: pickSlug({ id, date: body.date || null, sport: body.sport || null, bet: body.bet || null, isFree: access.is_free }),
        posted_at: new Date().toISOString(),
        source: 'admin',
        ...engineColumnsFromBody(body),
      }
    : {}

  // Which Desk game this is on: auto-matched, or the admin's choice.
  const gameCol = await gameIdPatch(admin, body, { sport: body.sport || null, date: body.date || null, bet: body.bet || null, opponent: body.opponent || null })

  const { data, error } = await admin.from('todays_bets').insert({
    ...engineCols,
    ...gameCol,
    date:            body.date            || null,
    sport:           body.sport           || null,
    risk:            body.risk            || null,
    bet:             body.bet             || null,
    line:            body.line            || null,
    vig:             body.vig             || null,
    opponent:        body.opponent        || null,
    win:             body.win             || null,
    result:          body.result          || 'pending',
    note:            body.note            || null,
    is_active:       body.is_active       ?? true,
    ...access,
    show_on_results: body.show_on_results ?? false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePublicPicks()

  // Announce the pick. Awaited rather than fire-and-forget: on Vercel the
  // function can be frozen once the response is returned, which would drop
  // in-flight sends. notifyNewPick never throws, so this can't fail the insert.
  // Pass notify:false in the body to save a pick silently.
  const notified = body.notify === false
    ? { skipped: 'suppressed by request' }
    : await notifyNewPick(data)

  return NextResponse.json({ ...data, notified }, { status: 201 })
}
