import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-02-25.clover',
    })
  }
  return _stripe
}

export function priceTier(priceId: string): 'basic' | 'premium' | null {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID) return 'basic'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID) return 'premium'
  return null
}
