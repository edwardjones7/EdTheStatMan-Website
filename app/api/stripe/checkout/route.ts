import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_PRICES = new Set([
  process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID,
])

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { priceId } = await req.json()
  if (!priceId || !ALLOWED_PRICES.has(priceId)) {
    return NextResponse.json({ error: 'Invalid price.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', session.user.id)
    .single()

  let customerId = (profile as any)?.stripe_customer_id as string | null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email!,
      metadata: { supabaseUserId: session.user.id },
    })
    customerId = customer.id
    await admin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', session.user.id)
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/betting-systems`,
    metadata: { userId: session.user.id },
    subscription_data: { metadata: { userId: session.user.id } },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
