import { NextResponse } from 'next/server'
import { getStripe, priceTier } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
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

    const tier = priceTier(priceId ?? '') ?? 'basic'
    const daysToAdd = tier === 'premium' ? 365 : 30
    const accessExpiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString()

    await (admin as any).from('profiles').update({
      stripe_customer_id: customerId,
      subscription_tier: tier,
      subscription_status: 'active',
      access_expires_at: accessExpiresAt,
    }).eq('id', userId)
  }

  return NextResponse.json({ received: true })
}
