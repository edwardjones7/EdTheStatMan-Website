// The membership offer, defined once.
//
// Nov 2026: three products, every one of them a ONE-TIME payment on one of two
// periods. Nothing recurs, anywhere. That is Ed's father's chargeback rule and
// it is the whole reason the monthly subscriptions were dropped:
//
//   month   30 days of access, one payment
//   year    365 days of access, one payment
//
// Both stack: a purchase adds its days on top of any access still running at
// the same product (see passExpiryFrom in the Stripe webhook).
//
// The Research Desk also has a 7-day free trial -- no card, one per account,
// and when it ends it simply ends (app/api/trial/route.ts). Copy anywhere on
// the site must never say or imply that a trial converts into a charge.
//
// NOTE: NEXT_PUBLIC_* env vars are only inlined by Next when written as literal
// static member expressions. Never index process.env dynamically.

import type { Tier } from './access'

/** The paid products. 'retail' is free and has no SKU. */
export type OfferTierKey = Exclude<Tier, 'retail'>

export type BillingPeriod = 'month' | 'year'

/**
 * What a purchase grants. 'days' stacks on top of any remaining access.
 * 'until' and 'subscription' are no longer sold; they stay so a legacy price
 * or a pre-change subscription still resolves in the webhook.
 */
export type AccessGrant =
  | { kind: 'days'; days: number }
  | { kind: 'until'; endsAt: string }
  | { kind: 'subscription' }

/**
 * The old season-pass end date. Nothing new is sold against it; it is kept for
 * the admin "grant a pass" control and the lifecycle emails of members who
 * bought a season pass before the change.
 */
export const SEASON_ENDS_AT = '2027-02-15T12:00:00Z'

/** Length of the Research Desk free trial. */
export const TRIAL_DAYS = 7

export interface OfferSku {
  tier: OfferTierKey
  period: BillingPeriod
  mode: 'payment'
  price: string
  /** Whole dollars, for the savings line. */
  amount: number
  grant: AccessGrant
  priceId: string
  ctaLabel: string
  note: string
}

export interface OfferPlan {
  key: OfferTierKey
  name: string
  /** Short name for nav pills, badges and the account page. */
  shortName: string
  tagline: string
  badge?: string
  features: string[]
  month: OfferSku
  year: OfferSku
}

function sku(
  tier: OfferTierKey, period: BillingPeriod, amount: number, priceId: string, ctaLabel: string,
): OfferSku {
  const days = period === 'month' ? 30 : 365
  return {
    tier, period, mode: 'payment', amount,
    price: `$${amount.toLocaleString('en-US')}`,
    grant: { kind: 'days', days },
    priceId,
    ctaLabel,
    note: `One-time payment · ${days} days`,
  }
}

// EVERY BULLET MUST BE TRUE TODAY. Every SKU is one-time, so a buyer has a
// year to notice a claim that was never true, which is the dispute the
// one-time pricing exists to avoid. Do not add a claim ahead of the code.
//
// Row-level CSV export was cut on purpose (2026-09-07): handing members the raw
// rows lets them leave with the data instead of coming back to the site. Do not
// re-add an export bullet, or a route behind it, without Eddie saying so.
//
// Order is the order Ed wants them shown: Research Desk, Vault, Portfolio.
export const OFFER_PLANS: OfferPlan[] = [
  {
    key: 'desk',
    name: 'The Research Desk',
    shortName: 'Research Desk',
    tagline: 'Everything we have: the Desk, the whole Vault and every pick.',
    badge: 'Everything',
    features: [
      'Complete Research Desk: every game in the NFL, college football, NBA and college basketball',
      'Opening and current lines on every game',
      'Systems and trends attached to each matchup',
      'The bets on each game, free and Portfolio',
      'Complete Handicapping Vault',
      'All EdTheStatBot Portfolio picks',
    ],
    month: sku('desk', 'month', 79, process.env.NEXT_PUBLIC_STRIPE_DESK_30D_PRICE_ID ?? '', 'Get 30 Days'),
    year: sku('desk', 'year', 699, process.env.NEXT_PUBLIC_STRIPE_DESK_365D_PRICE_ID ?? '', 'Get 365 Days'),
  },
  {
    key: 'private',
    name: 'Handicapping Vault',
    shortName: 'Vault',
    tagline: 'Every system and every trend, yours to search.',
    features: [
      'The complete systems library, unlocked',
      'The complete team trends library, unlocked',
      'Filter and sort across the whole Vault',
    ],
    month: sku('private', 'month', 39, process.env.NEXT_PUBLIC_STRIPE_VAULT_30D_PRICE_ID ?? '', 'Get 30 Days'),
    year: sku('private', 'year', 349, process.env.NEXT_PUBLIC_STRIPE_VAULT_365D_PRICE_ID ?? '', 'Get 365 Days'),
  },
  {
    key: 'portfolio',
    name: 'EdTheStatBot Portfolio',
    shortName: 'Portfolio',
    tagline: 'The picks themselves. Every play, graded.',
    features: [
      'Every EdTheStatBot pick, unlocked',
      'Full line and number on every play',
      'Instant alerts by email, push and Discord',
      'Complete graded history',
    ],
    month: sku('portfolio', 'month', 29, process.env.NEXT_PUBLIC_STRIPE_PORTFOLIO_30D_PRICE_ID ?? '', 'Get 30 Days'),
    year: sku('portfolio', 'year', 249, process.env.NEXT_PUBLIC_STRIPE_PORTFOLIO_365D_PRICE_ID ?? '', 'Get 365 Days'),
  },
]

/** "Save 26%": the 365-day price against twelve 30-day ones. */
export function annualSavingsPct(plan: OfferPlan): number {
  return Math.round((1 - plan.year.amount / (plan.month.amount * 12)) * 100)
}

/**
 * The comparison table on /win. Explicit per product rather than derived,
 * because the products are not a ladder: the Vault does not include the picks.
 */
export const OFFER_COMPARE_ROWS: { text: string; has: OfferTierKey[] }[] = [
  { text: 'Every EdTheStatBot pick, with line and number', has: ['desk', 'portfolio'] },
  { text: 'Pick alerts by email, push and Discord', has: ['desk', 'portfolio'] },
  { text: 'The complete systems and trends library', has: ['desk', 'private'] },
  { text: 'Every game on its own page, with opening and current lines', has: ['desk'] },
  { text: 'Systems and trends attached to each matchup', has: ['desk'] },
  { text: 'The bets on each game', has: ['desk'] },
]

/** The free account, shown as a comparison strip. */
export const OFFER_FREE_FEATURES: { text: string; included: boolean }[] = [
  { text: 'Free-tagged model picks', included: true },
  { text: 'Curated free systems and trends', included: true },
  { text: 'Records and win rates on every locked row', included: true },
  { text: 'X and Discord alerts', included: true },
  { text: 'The picks themselves', included: false },
  { text: 'The game boards and matchup research', included: false },
  { text: 'The full Vault library', included: false },
]

export const OFFER_DISCLAIMER =
  'No automatic renewal. No recurring charges. Access expires at the end of the purchased period. The Research Desk free trial needs no card and ends on its own after ' + TRIAL_DAYS + ' days.'

/** Entry price (the cheapest 30-day SKU), for nav and CTA button copy. */
export const OFFER_ENTRY_PRICE = [...OFFER_PLANS].sort((a, b) => a.month.amount - b.month.amount)[0].month.price

/**
 * The offer in one sentence, for page metadata.
 *
 * Derived rather than typed: /win carried a hand-written description naming
 * "Basic $19.99, Premium $119.99, the $249 Elite NFL Season Pass" for four days
 * after the ladder replaced all three, and that string is what Google and every
 * link preview showed. Anything that states the offer outside the cards should
 * be computed from OFFER_PLANS so it cannot survive the next price change.
 */
export const OFFER_META_DESCRIPTION =
  OFFER_PLANS.map(p => `${p.name} ${p.month.price} for 30 days or ${p.year.price} for 365`).join('; ') +
  `. One-time payments, nothing auto-renews. Try the Research Desk free for ${TRIAL_DAYS} days.`

export function planByKey(key: string): OfferPlan | undefined {
  return OFFER_PLANS.find(p => p.key === key)
}

/** Every sellable SKU, flattened. */
export const OFFER_SKUS: OfferSku[] = OFFER_PLANS.flatMap(p => [p.month, p.year])

/**
 * Look a SKU up by Stripe price ID. Returns undefined for an unknown price so
 * callers must decide explicitly — the old priceTier() silently fell back to
 * the cheapest tier, which meant a mis-set env var quietly sold the wrong thing.
 */
export function skuByPriceId(priceId: string): OfferSku | undefined {
  if (!priceId) return undefined
  return OFFER_SKUS.find(s => s.priceId === priceId)
}
