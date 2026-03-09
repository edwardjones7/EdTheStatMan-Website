import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

export function priceTier(priceId: string): 'basic' | 'premium' | null {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID) return 'basic'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID) return 'premium'
  return null
}
