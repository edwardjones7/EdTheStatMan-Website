import Stripe from 'stripe'
import { skuByPriceId, type OfferTierKey, type AccessGrant } from './offer'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
    })
  }
  return _stripe
}

/**
 * Pre-v3 prices. These are no longer sold, but a checkout session created
 * before the cutover can still complete afterwards, and grandfathered members
 * stay on them. Mapping them keeps those payments from hitting the
 * unknown-price path.
 *
 * NEXT_PUBLIC_* must be read as literal static member expressions to be inlined.
 */
function legacyPriceGrant(priceId: string): { tier: OfferTierKey; grant: AccessGrant } | null {
  if (priceId && priceId === process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID) {
    return { tier: 'desk', grant: { kind: 'days', days: 30 } }
  }
  if (priceId && priceId === process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID) {
    return { tier: 'private', grant: { kind: 'days', days: 365 } }
  }
  if (priceId && priceId === process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID) {
    return { tier: 'institutional', grant: { kind: 'until', endsAt: '2027-02-15T12:00:00Z' } }
  }
  return null
}

/**
 * Resolve a Stripe price to what it grants.
 *
 * Returns null for an unknown price. Callers MUST treat null as a failure and
 * not grant anything: the previous implementation fell back to the cheapest
 * tier, so a mis-set env var silently sold every buyer the wrong product.
 */
export function resolvePrice(priceId: string): { tier: OfferTierKey; grant: AccessGrant } | null {
  const sku = skuByPriceId(priceId)
  if (sku) return { tier: sku.tier, grant: sku.grant }
  return legacyPriceGrant(priceId)
}

/**
 * A Stripe subscription's period end, tolerant of API-version drift: newer
 * versions moved `current_period_end` from the subscription onto its items.
 */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): number | null {
  const anySub = sub as any
  const fromItem = anySub?.items?.data?.[0]?.current_period_end
  const end = fromItem ?? anySub?.current_period_end
  return typeof end === 'number' ? end * 1000 : null
}

/** The same, for an invoice. Falls back through the line items. */
export function invoicePeriodEnd(invoice: Stripe.Invoice): number | null {
  const anyInv = invoice as any
  const fromLine = anyInv?.lines?.data?.[0]?.period?.end
  const end = fromLine ?? anyInv?.period_end
  return typeof end === 'number' ? end * 1000 : null
}

/** The subscription id on an invoice, across API-version shapes. */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const anyInv = invoice as any
  const direct = anyInv?.subscription
  if (typeof direct === 'string') return direct
  if (direct?.id) return direct.id
  const nested = anyInv?.parent?.subscription_details?.subscription
  if (typeof nested === 'string') return nested
  if (nested?.id) return nested.id
  return null
}

/** The price id on a subscription, across API-version shapes. */
export function subscriptionPriceId(sub: Stripe.Subscription): string | null {
  const anySub = sub as any
  const price = anySub?.items?.data?.[0]?.price
  if (typeof price === 'string') return price
  return price?.id ?? null
}

// NOTE: there is deliberately no anti-downgrade helper here any more.
// Under the two-slot model (see tier_ladder_03_billing_slots.sql) "highest
// active grant wins" is emergent from recompute_entitlement(), so the old
// TIER_RANK comparison in the webhook was deleted rather than ported.
