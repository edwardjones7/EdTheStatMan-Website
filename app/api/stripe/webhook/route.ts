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

    const { data: existing } = await (admin as any)
      .from('profiles')
      .select('access_expires_at, subscription_tier, last_stripe_session_id')
      .eq('id', userId)
      .single()

    // Stripe retries webhooks on any non-2xx or timeout. Stacking is not
    // idempotent, so a retry would silently grant another 30/365 days.
    if (existing?.last_stripe_session_id === session.id) {
      return NextResponse.json({ received: true, deduped: true })
    }

    // Extend from whatever access remains rather than from today, so renewing
    // early never costs the buyer their unused days.
    const currentMs = existing?.access_expires_at ? new Date(existing.access_expires_at).getTime() : 0
    const base = Math.max(Date.now(), currentMs)
    const accessExpiresAt = new Date(base + daysToAdd * 24 * 60 * 60 * 1000).toISOString()

    // Don't downgrade a still-valid premium user who tops up with a basic pass;
    // the days stack either way, only the label would have regressed.
    const stillValid = currentMs > Date.now()
    const nextTier = stillValid && existing?.subscription_tier === 'premium' ? 'premium' : tier

    await (admin as any).from('profiles').update({
      stripe_customer_id: customerId,
      subscription_tier: nextTier,
      subscription_status: 'active',
      access_expires_at: accessExpiresAt,
      last_stripe_session_id: session.id,
    }).eq('id', userId)
  }

  return NextResponse.json({ received: true })
}
