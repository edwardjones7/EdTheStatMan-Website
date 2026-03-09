import { NextResponse } from 'next/server'
import { stripe, priceTier } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import type Stripe from 'stripe'

export const config = { api: { bodyParser: false } }

async function syncSubscription(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  updates: Record<string, unknown>
) {
  await admin.from('profiles').update(updates).eq('stripe_customer_id', customerId)
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const admin = createAdminClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode !== 'subscription') break

      const userId = session.metadata?.userId
      const customerId = session.customer as string
      const subscriptionId = session.subscription as string

      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const priceId = subscription.items.data[0]?.price.id
      const tier = priceTier(priceId) ?? 'basic'

      if (userId) {
        await admin.from('profiles').update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_tier: tier,
          subscription_status: 'active',
        }).eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const priceId = sub.items.data[0]?.price.id
      const tier = priceTier(priceId) ?? 'basic'

      await syncSubscription(admin, sub.customer as string, {
        stripe_subscription_id: sub.id,
        subscription_tier: tier,
        subscription_status: sub.status,
      })
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await syncSubscription(admin, sub.customer as string, {
        subscription_tier: 'free',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
      })
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        await syncSubscription(admin, invoice.customer as string, {
          subscription_status: 'past_due',
        })
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}
