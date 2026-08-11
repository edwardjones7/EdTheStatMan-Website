// The membership offer, defined once.
//
// Checkout is Stripe `mode: 'payment'` — these are ONE-TIME purchases that grant
// a fixed window of access and then lapse. Nothing recurs and there is nothing
// to cancel, so copy here must never imply a subscription ("billed monthly",
// "/mo", "cancel anytime").
//
// NOTE: NEXT_PUBLIC_* env vars are only inlined by Next when written as literal
// static member expressions. Never index process.env dynamically.

export type OfferTierKey = 'basic' | 'premium' | 'elite'

/**
 * What a purchase grants. 'days' stacks on top of any remaining access;
 * 'until' grants access through a fixed date (the Elite NFL Season Pass runs
 * through the Super Bowl regardless of purchase date).
 */
export type AccessGrant = { kind: 'days'; days: number } | { kind: 'until'; endsAt: string }

// Elite endsAt must be updated each season (Monday after the Super Bowl).
// The webhook falls back to a 30-day grant if this date is already past, so a
// stale constant can never sell access that is expired on arrival.
export const TIER_GRANT: Record<OfferTierKey, AccessGrant> = {
  basic: { kind: 'days', days: 30 },
  premium: { kind: 'days', days: 365 },
  elite: { kind: 'until', endsAt: '2027-02-15T12:00:00Z' },
}

export interface OfferPlan {
  key: OfferTierKey
  name: string
  price: string
  duration: string
  equivalent?: string
  badge?: string
  note: string
  features: string[]
  ctaLabel: string
  priceId: string
}

export const OFFER_PLANS: OfferPlan[] = [
  {
    key: 'basic',
    name: 'Basic',
    price: '$19.99',
    duration: '30 days of full access',
    note: 'One-time — no auto-renew',
    features: [
      'All EdTheStatBot picks',
      'Full betting systems library',
      'All betting trends unlocked',
      'All blog posts',
      'Premium Discord community',
    ],
    ctaLabel: 'Get 30 Days',
    priceId: process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID ?? '',
  },
  {
    key: 'premium',
    name: 'Premium',
    price: '$119.99',
    duration: '365 days of full access',
    equivalent: 'Just $10/mo equivalent',
    badge: 'Save 50%',
    note: 'One-time — no auto-renew',
    features: [
      'All EdTheStatBot picks',
      'Full betting systems library',
      'All betting trends unlocked',
      'All blog posts',
      'Premium Discord community',
      'Best value — 12 months for the price of 6',
    ],
    ctaLabel: 'Get 365 Days',
    priceId: process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID ?? '',
  },
  {
    key: 'elite',
    name: 'Elite — NFL Season Pass',
    price: '$249',
    duration: 'Access through the Super Bowl',
    badge: 'NFL Season',
    note: 'One-time — no auto-renew',
    features: [
      'Everything in Premium',
      'Weekly NFL game breakdowns, every matchup',
      'Systems & trends mapped to each game',
      'Edge Picks — highest-conviction plays',
      'Elite-only systems and trends',
    ],
    ctaLabel: 'Go Elite',
    priceId: process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID ?? '',
  },
]

export const OFFER_FREE_FEATURES: { text: string; included: boolean }[] = [
  { text: 'Free-tagged EdTheStatBot picks', included: true },
  { text: 'Curated free betting systems', included: true },
  { text: 'Free-tagged trends', included: true },
  { text: 'Free blog posts', included: true },
  // Alerts are open to everyone, so they belong here rather than on the paid cards.
  { text: 'X & Discord alerts', included: true },
  { text: 'All EdTheStatBot picks', included: false },
  { text: 'Full systems library', included: false },
  { text: 'All betting trends', included: false },
  { text: 'Premium Discord community', included: false },
]

export const OFFER_DISCLAIMER =
  'One-time payment. Access ends automatically on the expiry date — nothing auto-renews, so there is nothing to cancel. Buy again any time to extend; days are added to whatever you have left.'

/** Entry price, for nav and CTA button copy. */
export const OFFER_ENTRY_PRICE = OFFER_PLANS[0].price

export function planByKey(key: string): OfferPlan | undefined {
  return OFFER_PLANS.find(p => p.key === key)
}
