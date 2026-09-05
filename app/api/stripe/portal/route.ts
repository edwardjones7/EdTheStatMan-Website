import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { siteUrl } from '@/lib/site-url'

/**
 * The cancellation path.
 *
 * /win sells three monthly plans that say "Cancel anytime", and OFFER_DISCLAIMER
 * promises it can be done "from your account". Until this route existed that was
 * not true anywhere in the app: the webhook read `sub_cancel_at_period_end` and
 * nothing in the product could ever set it. Selling a subscription with no way
 * out is how you earn chargebacks, and in several jurisdictions it is not legal.
 *
 * Stripe's hosted Billing Portal rather than our own cancel button, because the
 * portal also carries invoice history, receipts and card updates, and because
 * every one of those is a place to get PCI scope or a dunning edge case wrong.
 * The live configuration (bpc_1TBgJ2...) already cancels at period end and
 * leaves plan switching off, which is what we want: switching plans goes through
 * /api/stripe/checkout, which modifies the existing subscription in place rather
 * than opening a second one.
 *
 * Cancelling in the portal fires customer.subscription.updated (with
 * cancel_at_period_end) and later customer.subscription.deleted. NEITHER IS
 * SUBSCRIBED ON THE LIVE WEBHOOK ENDPOINT YET -- it listens only for
 * checkout.session.completed -- so until those six events are added, a
 * cancellation here is correct in Stripe and invisible to our database.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await (admin as any)
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  const customerId = (profile as any)?.stripe_customer_id as string | null
  if (!customerId) {
    // A member who was granted access by hand, or whose only purchase predates
    // the customer-id write. There is nothing for the portal to show them.
    return NextResponse.json(
      { error: 'No billing history on this account yet.' },
      { status: 400 }
    )
  }

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${siteUrl()}/account`,
    })
    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    // The usual cause is no default portal configuration in this Stripe mode.
    // Live has one; a fresh test-mode account does not until it is saved once
    // in the dashboard, so this is the error a first test run will hit.
    console.error(`[stripe-portal] session create failed for ${customerId}: ${e?.message}`)
    return NextResponse.json(
      { error: 'Could not open the billing portal. Please contact support.' },
      { status: 500 }
    )
  }
}
