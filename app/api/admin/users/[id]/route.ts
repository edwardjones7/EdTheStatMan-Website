import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TIERS, type Tier } from '@/lib/access'
import { SEASON_ENDS_AT } from '@/lib/offer'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const admin = createAdminClient()
  const { data: p } = await (admin as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { ok: !!p?.is_admin as boolean, admin: admin as any, actorId: user.id }
}

/**
 * Comp, extend or revoke a member's access.
 *
 * THIS WRITES THE PASS SLOT AND NOTHING ELSE. `sub_*` belongs to Stripe --
 * customer.subscription.* and invoice.* are the only writers, and the whole
 * point of the two slots (tier_ladder_03_billing_slots.sql) is that a comp and
 * a subscription can coexist without either destroying the other. An admin
 * granting Private to somebody who also pays monthly for Institutional must not
 * downgrade them, and revoking the comp afterwards must not cancel what they
 * pay for. Writing one slot and letting recompute_entitlement() reconcile is
 * what makes both of those true for free.
 *
 * `subscription_tier` and `access_expires_at` are DERIVED. Never set them here:
 * the next webhook would recompute them from the slots and silently undo it.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const action = body.action

  const { data: target } = await admin
    .from('profiles')
    .select('id, email, pass_tier, pass_expires_at, sub_tier')
    .eq('id', params.id)
    .maybeSingle()
  if (!target) return NextResponse.json({ error: 'No such user.' }, { status: 404 })

  const update: Record<string, unknown> = {}

  if (action === 'revoke') {
    // Clears the comp only. Anyone on a live subscription keeps it, because
    // recompute_entitlement() still sees the sub slot.
    update.pass_tier = null
    update.pass_expires_at = null
  } else if (action === 'grant') {
    const tier = body.tier as Tier
    if (!TIERS.includes(tier) || tier === 'retail') {
      return NextResponse.json({ error: 'Pick a paid rung.' }, { status: 400 })
    }
    // 'season' is the default because it is the one date the product already
    // has an opinion about, and because a comp with no end date never gets
    // reviewed again -- it just quietly counts as a paying member forever.
    const expires =
      body.expiresAt === 'season' || !body.expiresAt
        ? SEASON_ENDS_AT
        : String(body.expiresAt)
    const when = new Date(expires)
    if (Number.isNaN(when.getTime())) {
      return NextResponse.json({ error: 'Unreadable expiry date.' }, { status: 400 })
    }
    if (when.getTime() <= Date.now()) {
      // Would silently grant nothing: resolveAccess() reads a past expiry as
      // lapsed. Say so rather than appearing to work.
      return NextResponse.json({ error: 'That date is in the past.' }, { status: 400 })
    }
    update.pass_tier = tier
    update.pass_expires_at = when.toISOString()
  } else {
    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  }

  const { error: upErr } = await admin.from('profiles').update(update).eq('id', params.id)
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // Derives subscription_tier, access_expires_at and billing_mode from whichever
  // slots are live. Every Stripe webhook calls this after writing its slot; an
  // admin write is no different.
  const { error: rpcErr } = await admin.rpc('recompute_entitlement', { p_user: params.id })
  if (rpcErr) return NextResponse.json({ error: `Saved, but recompute failed: ${rpcErr.message}` }, { status: 500 })

  const { data: after } = await admin
    .from('profiles')
    .select('id, subscription_tier, access_expires_at, pass_tier, pass_expires_at, sub_tier, sub_current_period_end, billing_mode')
    .eq('id', params.id)
    .single()

  return NextResponse.json(after)
}
