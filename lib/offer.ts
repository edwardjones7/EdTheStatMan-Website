// The membership offer, defined once.
//
// v3 is a five-rung ladder sold on two billing periods:
//
//   month   The Portfolio is a ONE-TIME 30-day purchase (it never recurs).
//           Desk / Private / Institutional are true Stripe subscriptions.
//   season  Always a one-time payment granting access through the Super Bowl.
//
// The season pass is the SKU we push: one sale and one dispute window instead
// of twelve of each. Copy on a `payment` SKU must never imply a subscription
// ("billed monthly", "cancel anytime"); copy on a `subscription` SKU must.
//
// NOTE: NEXT_PUBLIC_* env vars are only inlined by Next when written as literal
// static member expressions. Never index process.env dynamically.

import type { Tier } from './access'

/** The paid rungs. 'retail' is free and has no SKU. */
export type OfferTierKey = Exclude<Tier, 'retail'>

export type BillingPeriod = 'month' | 'season'

/**
 * What a purchase grants. 'days' stacks on top of any remaining access;
 * 'until' grants access through a fixed date (a season pass runs through the
 * Super Bowl regardless of purchase date). Subscriptions use neither — their
 * clock comes from the Stripe billing period end.
 */
export type AccessGrant =
  | { kind: 'days'; days: number }
  | { kind: 'until'; endsAt: string }
  | { kind: 'subscription' }

/**
 * Season passes end here. Must be bumped each season (Monday after the Super
 * Bowl). The webhook falls back to a 30-day grant if this date is already past,
 * so a stale constant can never sell access that is expired on arrival.
 */
export const SEASON_ENDS_AT = '2027-02-15T12:00:00Z'

export interface OfferSku {
  tier: OfferTierKey
  period: BillingPeriod
  /** Stripe checkout mode. Only monthly Desk/Private/Institutional recur. */
  mode: 'payment' | 'subscription'
  price: string
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
  /** What this rung adds on top of the one below it. */
  features: string[]
  month: OfferSku
  season: OfferSku
}

// EVERY BULLET WITHOUT A "Coming this season" PREFIX MUST BE TRUE TODAY.
// Checked against production 2026-09-05 before launch, and several were not:
//   - "unit sizing"        todays_bets.risk is NULL on all 206 rows
//   - Desk curated trends  nfl_game_trends = 0 rows
//   - the weekly desk note desk_notes = 0 rows
//   - system-trigger alerts  no such code; lib/notify fires on pick inserts
//   - all four Institutional tools  no export route, query builder, key issuing
//                                   or backtester exists anywhere in the repo
//
// THE z SPLIT IS THE REAL PRIVATE/INSTITUTIONAL LINE: Private carries 2.5-2.99,
// Institutional carries 3.0+. There is no `z` column -- it is computed from w
// and l against a 50% null, pushes excluded:
//     z = (w/(w+l) - 0.5) / sqrt(0.25 / (w+l))
// NEVER PUT THOSE NUMBERS OR THAT FORMULA IN CUSTOMER COPY. The bullets say
// "significance bar" and "strictest bar" on purpose --- the thresholds and the
// null we test against are the product, not a selling point. Keep the split
// internal; this comment is the only place it is written down in the app.
// Measured 2026-09-05 over active rows: 36 of 78 systems and 32 of 203 trends
// reach 3.0+, so the tier has 68 rows of its own. Note the null matters ---
// against the -110 break-even of 52.38% NOTHING reaches 3.0, and the card would
// be empty. These two bullets are only true while rows are actually tagged
// min_tier='institutional'; see docs/MIGRATIONS.md.
// A season pass is one-time and runs to February, which is a long time for a
// buyer to notice a bullet that was never true. That is the same dispute the
// one-time pricing exists to avoid, so do not re-add a claim ahead of the code.
export const OFFER_PLANS: OfferPlan[] = [
  {
    key: 'portfolio',
    name: 'The Portfolio',
    shortName: 'Portfolio',
    tagline: 'The picks themselves. Every play, graded.',
    features: [
      'Every model pick, unlocked',
      'Full line and number on every play',
      'Instant alerts by email, push and Discord',
      'Complete graded history',
    ],
    month: {
      tier: 'portfolio', period: 'month', mode: 'payment', price: '$49',
      grant: { kind: 'days', days: 30 },
      priceId: process.env.NEXT_PUBLIC_STRIPE_PORTFOLIO_MONTH_PRICE_ID ?? '',
      ctaLabel: 'Get 30 Days', note: 'One-time. Never auto-renews.',
    },
    season: {
      tier: 'portfolio', period: 'season', mode: 'payment', price: '$199',
      grant: { kind: 'until', endsAt: SEASON_ENDS_AT },
      priceId: process.env.NEXT_PUBLIC_STRIPE_PORTFOLIO_SEASON_PRICE_ID ?? '',
      ctaLabel: 'Get the Season', note: 'One-time. Through the Super Bowl.',
    },
  },
  {
    key: 'desk',
    name: 'The Research Desk',
    shortName: 'Research Desk',
    tagline: 'The whole season on one screen, curated game by game.',
    badge: 'Most Popular',
    features: [
      'Everything in The Portfolio',
      'The full season schedule, live as it moves',
      'Opening and current lines: spread, total and moneyline',
      'Every game on its own page, NFL and college football',
      'Coming this season — curated trends attached to each matchup',
      'Coming this season — the weekly desk note',
    ],
    month: {
      tier: 'desk', period: 'month', mode: 'subscription', price: '$129',
      grant: { kind: 'subscription' },
      priceId: process.env.NEXT_PUBLIC_STRIPE_DESK_MONTH_PRICE_ID ?? '',
      ctaLabel: 'Open the Desk', note: 'Billed monthly. Cancel anytime.',
    },
    season: {
      tier: 'desk', period: 'season', mode: 'payment', price: '$499',
      grant: { kind: 'until', endsAt: SEASON_ENDS_AT },
      priceId: process.env.NEXT_PUBLIC_STRIPE_DESK_SEASON_PRICE_ID ?? '',
      ctaLabel: 'Get the Season', note: 'One-time. Through the Super Bowl.',
    },
  },
  {
    key: 'private',
    name: 'Vault — Private Intelligence',
    shortName: 'Private',
    tagline: 'The full Vault. Every system, every trend, yours to search.',
    features: [
      'Everything in The Research Desk',
      'The complete systems library, unlocked',
      'The complete team trends library, unlocked',
      'Every system and trend that clears our significance bar',
      'Filter and sort across the whole Vault',
      'Coming this season — alerts the moment a system triggers',
    ],
    month: {
      tier: 'private', period: 'month', mode: 'subscription', price: '$199',
      grant: { kind: 'subscription' },
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRIVATE_MONTH_PRICE_ID ?? '',
      ctaLabel: 'Enter the Vault', note: 'Billed monthly. Cancel anytime.',
    },
    season: {
      tier: 'private', period: 'season', mode: 'payment', price: '$799',
      grant: { kind: 'until', endsAt: SEASON_ENDS_AT },
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRIVATE_SEASON_PRICE_ID ?? '',
      ctaLabel: 'Get the Season', note: 'One-time. Through the Super Bowl.',
    },
  },
  {
    key: 'institutional',
    name: 'Vault — Institutional Intelligence',
    shortName: 'Institutional',
    tagline: 'The strongest signals we have, and first access to what we build next.',
    badge: 'Institutional',
    features: [
      'Everything in Private Intelligence',
      'The highest-conviction library: the signals that clear our strictest bar, at this tier only',
      'Coming this season — full row-level export, every system and trend as CSV',
      'Coming this season — query builder across the entire Vault',
      'Coming this season — API key for programmatic access',
      'Coming this season — backtest your own systems against our data',
    ],
    month: {
      tier: 'institutional', period: 'month', mode: 'subscription', price: '$399',
      grant: { kind: 'subscription' },
      priceId: process.env.NEXT_PUBLIC_STRIPE_INSTITUTIONAL_MONTH_PRICE_ID ?? '',
      ctaLabel: 'Go Institutional', note: 'Billed monthly. Cancel anytime.',
    },
    season: {
      tier: 'institutional', period: 'season', mode: 'payment', price: '$1,499',
      grant: { kind: 'until', endsAt: SEASON_ENDS_AT },
      priceId: process.env.NEXT_PUBLIC_STRIPE_INSTITUTIONAL_SEASON_PRICE_ID ?? '',
      ctaLabel: 'Get the Season', note: 'One-time. Through the Super Bowl.',
    },
  },
]

/** Vault — Public Intelligence: the free rung, shown as a comparison strip. */
export const OFFER_FREE_FEATURES: { text: string; included: boolean }[] = [
  { text: 'Free-tagged model picks', included: true },
  { text: 'Curated free systems and trends', included: true },
  { text: 'Records and win rates on every locked row', included: true },
  { text: 'Free blog posts', included: true },
  { text: 'X and Discord alerts', included: true },
  { text: 'The picks themselves', included: false },
  { text: 'The season schedule and curated matchup trends', included: false },
  { text: 'The full Vault library', included: false },
  { text: 'Raw export, query builder and API', included: false },
]

export const OFFER_DISCLAIMER =
  'Season passes are a one-time payment and end automatically on the expiry date. Nothing auto-renews, so there is nothing to cancel. Monthly plans on The Research Desk and above bill every month until you cancel, which you can do at any time from your account. The Portfolio never recurs.'

/** Entry price, for nav and CTA button copy. */
export const OFFER_ENTRY_PRICE = OFFER_PLANS[0].month.price

export function planByKey(key: string): OfferPlan | undefined {
  return OFFER_PLANS.find(p => p.key === key)
}

/** Every sellable SKU, flattened. */
export const OFFER_SKUS: OfferSku[] = OFFER_PLANS.flatMap(p => [p.month, p.season])

/**
 * Look a SKU up by Stripe price ID. Returns undefined for an unknown price so
 * callers must decide explicitly — the old priceTier() silently fell back to
 * the cheapest tier, which meant a mis-set env var quietly sold the wrong thing.
 */
export function skuByPriceId(priceId: string): OfferSku | undefined {
  if (!priceId) return undefined
  return OFFER_SKUS.find(s => s.priceId === priceId)
}
