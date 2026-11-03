import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OFFER_SKUS, skuByPriceId } from '@/lib/offer'
import { normalizeTier } from '@/lib/access'
import { isTrialPass } from '@/lib/trial'
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
    .select('stripe_customer_id, pass_tier, pass_expires_at')
    .eq('id', user.id)
    .single()

  // The trial marker is read on its own so a missing column (migration not yet
  // applied) cannot fail the purchase: no column, no trial, no special case.
  const { data: trialRow } = await (admin as any)
    .from('profiles')
    .select('desk_trial_ends_at')
    .eq('id', user.id)
    .maybeSingle()

  // ---- Guard: what they already hold ---------------------------------------
  // Same rules as cardState() in components/PricingCards.tsx, so the server
  // never refuses a button the page offered. Never take a payment that could
  // read as a mistake later -- that is the dispute the one-time pricing exists
  // to avoid.
  //
  //   same product, 365 days   allowed: the days stack on what they hold
  //   same product, 30 days    refused while live: a second 30 on top of a
  //                            live 30 is far more often a double click than
  //                            a plan
  //   Research Desk            always allowed: it holds the other two
  //   Vault <-> Portfolio      refused while live: the pass slot holds ONE
  //                            product, so buying the sibling would replace
  //                            what they paid for. They are pointed at the
  //                            Research Desk, the one plan with both.
  //   anything below the Desk  refused for a Desk holder
  //
  // The free trial is not a purchase and never blocks one.
  const passTier = (profile as any)?.pass_tier as string | null
  const passUntil = (profile as any)?.pass_expires_at as string | null
  const passLive = !!passUntil && new Date(passUntil).getTime() > Date.now()
  const onTrial = isTrialPass({ ...(profile as any), desk_trial_ends_at: (trialRow as any)?.desk_trial_ends_at ?? null })

  if (passLive && passTier && !onTrial) {
    const held = normalizeTier(passTier)
    const refuse = (error: string) => NextResponse.json({ error, heldTier: held, heldUntil: passUntil }, { status: 409 })
    if (sku.tier === held && sku.period !== 'year') {
      return refuse('You already have this plan. Choose 365 days to add a year on top.')
    }
    if (sku.tier !== held && sku.tier !== 'desk') {
      return refuse(held === 'desk'
        ? 'The Research Desk already includes this.'
        : 'To have both the Vault and the Portfolio, choose the Research Desk.')
    }
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

  const sessionParams = {
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // Every SKU is a one-time payment. Nothing on the site recurs.
    mode: sku.mode,
    success_url: `${siteUrl()}/account?success=1`,
    cancel_url: `${siteUrl()}/win?canceled=1`,
    metadata: { userId: user.id, priceId, tier: sku.tier, period: sku.period, ...attr },
    allow_promotion_codes: true,
    // The no-refund policy, on the page where they pay. Shown beside the pay
    // button, it is the strongest evidence in a dispute that the terms were
    // seen before purchase. Plain text: no markup is relied on here.
    custom_text: {
      submit: {
        message:
          'One-time payment; nothing renews. All sales are final; no refunds. Picks and research are information and entertainment ' +
          'only, with no outcome guaranteed. 21+. Terms: edthestatman.com/terms',
      },
    },
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

  // Funnel event, recorded server side because only here do we know a Stripe
  // session really exists: checkout_click fires on the button even when the
  // request then 401s, 409s or errors. Awaited but never allowed to fail the
  // purchase -- the buyer already has a session to go to.
  try {
    const { error } = await (admin as any).from('events').insert({
      event_type: 'checkout_started',
      path: '/api/stripe/checkout',
      user_id: user.id,
      meta: { tier: sku.tier, period: sku.period },
    })
    if (error) console.error(`[checkout] could not record checkout_started: ${error.message}`)
  } catch (e: any) {
    console.error(`[checkout] could not record checkout_started: ${e?.message}`)
  }

  return NextResponse.json({ url: checkoutSession.url })
}
