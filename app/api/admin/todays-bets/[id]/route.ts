import { NextResponse } from 'next/server'
import { TIER_RANK, normalizeTier, type Tier } from '@/lib/access'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

export async function PUT(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await Promise.resolve(context.params)
  const body = await req.json()
  const access = accessColumns(body)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: 400 })

  const { data, error } = await admin.from('todays_bets').update({
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
    updated_at:      new Date().toISOString(),
  }).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await Promise.resolve(context.params)
  const { error } = await admin.from('todays_bets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
