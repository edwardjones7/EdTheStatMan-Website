import { NextResponse } from 'next/server'
import { getStripe, subscriptionPriceId } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFER_SKUS, skuByPriceId } from '@/lib/offer'
import { TIER_RANK, normalizeTier } from '@/lib/access'
import { siteUrl } from '@/lib/site-url'

/** Derived from the catalog so it can never drift from what /win renders. */
const ALLOWED_PRICES = new Set(OFFER_SKUS.map(s => s.priceId).filter(Boolean))

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { priceId, attribution } = await req.json()
  if (!priceId || !ALLOWED_PRICES.has(priceId)) {
    return NextResponse.json({ error: 'Invalid price.' }, { status: 400 })
  }
  const sku = skuByPriceId(priceId)
  if (!sku) return NextResponse.json({ error: 'Invalid price.' }, { status: 400 })

  // First-touch attribution rides Stripe metadata into the webhook, which
  // snapshots it onto the purchases ledger row.
  const attr: Record<string, string> = {}
  if (attribution && typeof attribution === 'object') {
    const fields: Array<[string, string]> = [
      ['utm_source', 'source'],
      ['utm_medium', 'medium'],
      ['utm_campaign', 'campaign'],
      ['referrer', 'referrer'],
      ['landing_page', 'landing_page'],
    ]
    for (const [key, from] of fields) {
      const value = (attribution as any)[from]
      if (typeof value === 'string' && value.trim()) attr[key] = value.trim().slice(0, 200)
    }
  }

  const admin = createAdminClient()
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, pass_tier, pass_expires_at')
    .eq('id', user.id)
    .single()

  // ---- Guard: already holds a pass at or above what they're buying ---------
  // Do not take another payment for something they already own until February.
  // Never create a reason to dispute -- the same instinct as pushing the season
  // pass in the first place.
  const passTier = (profile as any)?.pass_tier as string | null
  const passUntil = (profile as any)?.pass_expires_at as string | null
  const passLive = !!passUntil && new Date(passUntil).getTime() > Date.now()
  if (passLive && passTier && TIER_RANK[normalizeTier(passTier)] >= TIER_RANK[sku.tier]) {
    return NextResponse.json({
      error: 'You already hold access at this level.',
      heldTier: normalizeTier(passTier),
      heldUntil: passUntil,
    }, { status: 409 })
  }

  async function freshCustomer(): Promise<string> {
    const customer = await getStripe().customers.create({
      email: user!.email!,
      metadata: { supabaseUserId: user!.id },
    })
    await (admin as any).from('profiles')
      .update({ stripe_customer_id: customer.id }).eq('id', user!.id)
    return customer.id
  }

  let customerId = (profile as any)?.stripe_customer_id as string | null
  if (!customerId) customerId = await freshCustomer()

  // ---- Guard: switching plans on a live subscription ----------------------
  // Opening a second checkout session would create a SECOND subscription and
  // double-bill. Modify the existing one in place instead; the resulting
  // customer.subscription.updated event drives recompute_entitlement().
  const existingSubId = (profile as any)?.stripe_subscription_id as string | null
  if (sku.mode === 'subscription' && existingSubId) {
    try {
      const current = await getStripe().subscriptions.retrieve(existingSubId)
      const item = (current as any)?.items?.data?.[0]
      if (item && subscriptionPriceId(current) !== sku.priceId) {
        await getStripe().subscriptions.update(existingSubId, {
          items: [{ id: item.id, price: sku.priceId }],
          proration_behavior: 'always_invoice',
          metadata: { userId: user.id, tier: sku.tier },
        })
        return NextResponse.json({ redirect: '/account?updated=1' })
      }
      if (item) {
        return NextResponse.json({ error: 'You are already on this plan.' }, { status: 409 })
      }
    } catch (e: any) {
      // A stale subscription id (deleted in Stripe) should not block a new buy.
      console.error(`[checkout] could not modify subscription ${existingSubId}: ${e?.message}`)
    }
  }

  const sessionParams = {
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: sku.mode,
    // customer.subscription.* events carry the SUBSCRIPTION's metadata, not the
    // session's. Without this the subscription handler cannot resolve a user
    // except by customer-id lookup.
    ...(sku.mode === 'subscription'
      ? { subscription_data: { metadata: { userId: user.id, tier: sku.tier, period: sku.period } } }
      : {}),
    success_url: `${siteUrl()}/account?success=1`,
    cancel_url: `${siteUrl()}/win?canceled=1`,
    metadata: { userId: user.id, priceId, tier: sku.tier, period: sku.period, ...attr },
    allow_promotion_codes: true,
  }

  // A STORED CUSTOMER ID CAN BE STALE, and trusting it absolutely is a dead end
  // for the member: deleted in Stripe, or belonging to a different account or
  // mode, and every checkout 500s forever with an empty body and no way for
  // them to recover. Same reasoning as the stale-subscription catch above --
  // that one already exists, this one was missing.
  //
  // Only 'resource_missing' on the customer param is recoverable this way. Any
  // other Stripe error still throws, because re-pointing a member at a brand
  // new customer record is not a fix for a problem that is not the customer.
  let checkoutSession
  try {
    checkoutSession = await getStripe().checkout.sessions.create(sessionParams)
  } catch (e: any) {
    const staleCustomer = e?.code === 'resource_missing' && e?.param === 'customer'
    if (!staleCustomer) throw e
    console.error(`[checkout] stale stripe_customer_id ${customerId} for ${user.id}; recreating`)
    sessionParams.customer = await freshCustomer()
    checkoutSession = await getStripe().checkout.sessions.create(sessionParams)
  }

  return NextResponse.json({ url: checkoutSession.url })
}
