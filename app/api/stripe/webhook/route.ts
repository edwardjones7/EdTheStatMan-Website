import { NextResponse } from 'next/server'
import { getStripe, priceTier } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_GRANT } from '@/lib/offer'
import { TIER_RANK, type SubscriptionTier } from '@/lib/access'
import type Stripe from 'stripe'

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    if (session.mode !== 'payment') return NextResponse.json({ received: true })

    const userId = session.metadata?.userId
    const priceId = session.metadata?.priceId
    const customerId = session.customer as string

    if (!userId) return NextResponse.json({ received: true })

    const knownTier = priceTier(priceId ?? '')
    if (!knownTier) {
      // A mis-set price env var would silently sell every buyer a basic pass.
      console.error(`[stripe-webhook] Unrecognized priceId "${priceId}" on session ${session.id}; falling back to basic`)
    }
    const tier = knownTier ?? 'basic'

    const { data: existing } = await (admin as any)
      .from('profiles')
      .select('access_expires_at, subscription_tier, last_stripe_session_id, attributed_at')
      .eq('id', userId)
      .single()

    // Stripe retries webhooks on any non-2xx or timeout. Stacking is not
    // idempotent, so a retry would silently grant another 30/365 days.
    if (existing?.last_stripe_session_id === session.id) {
      return NextResponse.json({ received: true, deduped: true })
    }

    // Revenue ledger. The unique stripe_session_id + ignoreDuplicates is a
    // second idempotency layer independent of the profile dedupe above.
    const md = session.metadata ?? {}
    await (admin as any).from('purchases').upsert({
      user_id: userId,
      stripe_session_id: session.id,
      price_id: priceId ?? null,
      tier,
      amount_cents: session.amount_total ?? 0,
      currency: session.currency ?? 'usd',
      utm_source: md.utm_source || null,
      utm_medium: md.utm_medium || null,
      utm_campaign: md.utm_campaign || null,
      referrer: md.referrer || null,
      landing_page: md.landing_page || null,
    }, { onConflict: 'stripe_session_id', ignoreDuplicates: true })

    // Extend from whatever access remains rather than from today, so renewing
    // early never costs the buyer their unused days. Fixed-date grants (Elite
    // season pass) take max(existing, season end) — never shortening access.
    const currentMs = existing?.access_expires_at ? new Date(existing.access_expires_at).getTime() : 0
    const base = Math.max(Date.now(), currentMs)
    const grant = TIER_GRANT[tier]
    let accessExpiresAt: string
    if (grant.kind === 'until' && new Date(grant.endsAt).getTime() > Date.now()) {
      accessExpiresAt = new Date(Math.max(currentMs, new Date(grant.endsAt).getTime())).toISOString()
    } else {
      if (grant.kind === 'until') {
        // Season-end constant is stale: never sell access that is already
        // expired — grant 30 days instead and flag it loudly.
        console.error(`[stripe-webhook] TIER_GRANT.${tier}.endsAt (${grant.endsAt}) is in the past; granting 30 days for session ${session.id}`)
      }
      const days = grant.kind === 'days' ? grant.days : 30
      accessExpiresAt = new Date(base + days * 24 * 60 * 60 * 1000).toISOString()
    }

    // Don't downgrade a still-valid higher-tier user who tops up with a
    // cheaper pass; the time stacks either way, only the label would regress.
    const stillValid = currentMs > Date.now()
    const existingTier = (existing?.subscription_tier ?? 'free') as SubscriptionTier
    const nextTier =
      stillValid && (TIER_RANK[existingTier] ?? 0) > TIER_RANK[tier] ? existingTier : tier

    // Catches buyers whose profile never got first-touch attribution stamped
    // (e.g. they purchased before loading any page while logged in).
    const hasAttr = md.utm_source || md.utm_medium || md.utm_campaign || md.referrer
    const attrStamp = !existing?.attributed_at && hasAttr ? {
      utm_source: md.utm_source || null,
      utm_medium: md.utm_medium || null,
      utm_campaign: md.utm_campaign || null,
      first_referrer: md.referrer || null,
      landing_page: md.landing_page || null,
      attributed_at: new Date().toISOString(),
    } : {}

    await (admin as any).from('profiles').update({
      stripe_customer_id: customerId,
      subscription_tier: nextTier,
      subscription_status: 'active',
      access_expires_at: accessExpiresAt,
      last_stripe_session_id: session.id,
      ...attrStamp,
    }).eq('id', userId)
  }

  return NextResponse.json({ received: true })
}
