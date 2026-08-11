import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_PRICES = new Set([
  process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID,
  process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID,
])

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { priceId, attribution } = await req.json()
  if (!priceId || !ALLOWED_PRICES.has(priceId)) {
    return NextResponse.json({ error: 'Invalid price.' }, { status: 400 })
  }

  // First-touch attribution rides Stripe metadata into the webhook, which
  // snapshots it onto the purchases ledger row.
  const attr: Record<string, string> = {}
  if (attribution && typeof attribution === 'object') {
    const fields: Array<[string, string]> = [
      ['utm_source', 'source'],
      ['utm_medium', 'medium'],
      ['utm_campaign', 'campaign'],
      ['referrer', 'referrer'],
      ['landing_page', 'landing_page'],
    ]
    for (const [key, from] of fields) {
      const value = (attribution as any)[from]
      if (typeof value === 'string' && value.trim()) attr[key] = value.trim().slice(0, 200)
    }
  }

  const admin = createAdminClient()
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  let customerId = (profile as any)?.stripe_customer_id as string | null

  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: user.email!,
      metadata: { supabaseUserId: user.id },
    })
    customerId = customer.id
    await (admin as any).from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
  }

  const checkoutSession = await getStripe().checkout.sessions.create({
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/account?success=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/win?canceled=1`,
    metadata: { userId: user.id, priceId, ...attr },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: checkoutSession.url })
}
