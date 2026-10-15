import { NextResponse } from 'next/server'
import {
  getStripe,
  resolvePrice,
  subscriptionPeriodEnd,
  subscriptionPriceId,
  invoicePeriodEnd,
  invoiceSubscriptionId,
} from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyPayment } from '@/lib/notify/admin'
import { welcomeMessage, paymentFailedMessage, sendLifecycleEmail } from '@/lib/notify/lifecycle'
import { claimEmail, recordPurchaseEvent } from '@/lib/notify/lifecycle-log'
import { syncDiscordRole } from '@/lib/discord/roles'
import type { AccessGrant } from '@/lib/offer'
import type { Tier } from '@/lib/access'
import type Stripe from 'stripe'

/**
 * TWO SLOTS, ONE DERIVED ENTITLEMENT.
 *
 * Handlers here write exactly ONE grant slot and then call
 * recompute_entitlement(), which derives subscription_tier and
 * access_expires_at as the max over whichever slots are currently active.
 *
 *   pass_*  one-time purchases (Portfolio $49/$199, every season pass)
 *   sub_*   Stripe subscriptions (monthly Desk / Private / Institutional)
 *
 * No handler computes a tier or an expiry itself. In particular there is NO
 * anti-downgrade branch: "highest active grant wins" falls out of the recompute
 * function, so the old TIER_RANK comparison is deleted rather than ported.
 *
 * See supabase/migrations/tier_ladder_03_billing_slots.sql for the full
 * rationale, including the revenue leak the single-column model allowed.
 *
 * IDEMPOTENCY, three layers:
 *   1. stripe_events insert-first  -- covers every event type.
 *   2. Subscription writes set ABSOLUTE values read off the event payload, so
 *      replaying one is inherently a no-op. The pass path STACKS days and so
 *      genuinely needs (1) plus the last_stripe_session_id guard.
 *   3. sub_event_at watermark -- Stripe does not guarantee ordering, and a
 *      stale `updated` arriving after `deleted` would un-cancel a subscription.
 */

const DAY_MS = 24 * 60 * 60 * 1000

interface ProfileRow {
  id: string
  email: string | null
  pass_expires_at: string | null
  attributed_at: string | null
  last_stripe_session_id: string | null
  sub_event_at: string | null
}

// `email` is here only so the admin alerts can name the customer; nothing
// else in this route reads it.
const PROFILE_COLS = 'id, email, pass_expires_at, attributed_at, last_stripe_session_id, sub_event_at'

async function profileById(admin: any, userId: string): Promise<ProfileRow | null> {
  const { data } = await admin.from('profiles').select(PROFILE_COLS).eq('id', userId).single()
  return data ?? null
}

async function profileByCustomer(admin: any, customerId: string | null): Promise<ProfileRow | null> {
  if (!customerId) return null
  const { data } = await admin
    .from('profiles').select(PROFILE_COLS).eq('stripe_customer_id', customerId).single()
  return data ?? null
}

/**
 * Subscription and invoice events carry no userId of their own. Prefer the
 * metadata the checkout route stamps onto subscription_data, and fall back to
 * the customer id so a subscription created outside our checkout still lands.
 */
async function resolveUser(
  admin: any,
  metaUserId: string | null | undefined,
  customerId: string | null
): Promise<ProfileRow | null> {
  if (metaUserId) {
    const byId = await profileById(admin, metaUserId)
    if (byId) return byId
  }
  return profileByCustomer(admin, customerId)
}

/** New pass expiry from a grant, never shortening what the member already has. */
function passExpiryFrom(grant: AccessGrant, currentMs: number, ref: string): string {
  const now = Date.now()
  if (grant.kind === 'until') {
    const endsAt = new Date(grant.endsAt).getTime()
    if (endsAt > now) return new Date(Math.max(currentMs, endsAt)).toISOString()
    console.error(`[stripe-webhook] season endsAt (${grant.endsAt}) is in the past; granting 30 days for ${ref}`)
    return new Date(Math.max(now, currentMs) + 30 * DAY_MS).toISOString()
  }
  if (grant.kind === 'days') {
    // Extend from whatever remains rather than from today, so buying again
    // early never costs the member their unused days.
    return new Date(Math.max(now, currentMs) + grant.days * DAY_MS).toISOString()
  }
  // A subscription grant never reaches the pass slot.
  return new Date(Math.max(now, currentMs)).toISOString()
}

// Every handler funnels through here after writing its one slot, so hooking the
// Discord sync in this single place covers purchase, renewal, plan change,
// cancellation, dunning and refund without touching six call sites.
async function recompute(admin: any, userId: string) {
  const { error } = await admin.rpc('recompute_entitlement', { p_user: userId })
  if (error) console.error(`[stripe-webhook] recompute_entitlement failed for ${userId}: ${error.message}`)

  // Fire-and-forget by contract: syncDiscordRole never throws and never blocks a
  // payment. A Discord outage must not fail a webhook Stripe will then retry.
  const discord = await syncDiscordRole(userId)
  if (discord.outcome === 'error') {
    console.error(`[stripe-webhook] discord sync failed for ${userId}: ${discord.detail}`)
  }
}

async function recordPurchase(admin: any, row: Record<string, unknown>, conflictKey: string) {
  const { error } = await admin
    .from('purchases').upsert(row, { onConflict: conflictKey, ignoreDuplicates: true })
  // NEVER swallow this. The ledger is the only record of revenue, and a failure
  // here does not affect entitlement -- the member keeps the access they paid
  // for -- so nothing else in the system will ever notice. A partial unique
  // index on stripe_invoice_id made every subscription cycle fail with 42P10
  // for exactly as long as this function ignored the result.
  if (error) {
    console.error(
      `[stripe-webhook] PURCHASE LEDGER WRITE FAILED (${error.code}): ${error.message} ` +
      `-- row ${JSON.stringify(row)}`
    )
  }
}

/**
 * Everything that runs AFTER a grant has been written: the welcome email and
 * the funnel event. Wrapped so that no failure in here -- Resend down, events
 * table renamed, a template bug -- can reach the response. Stripe retries a
 * non-2xx, and the retry would be deduped by stripe_events anyway, so a throw
 * here would buy nothing but a red event in the dashboard.
 */
async function afterGrant(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e: any) {
    console.error(`[stripe-webhook] ${label} failed (grant unaffected): ${e?.message ?? e}`)
  }
}

/**
 * ONE welcome per purchase, from exactly one hook per billing mode:
 *   pass          checkout.session.completed (mode 'payment')
 *   subscription  invoice.payment_succeeded with billing_reason
 *                 'subscription_create' -- the first paid invoice.
 * Not customer.subscription.created: it fires before payment can still fail
 * (status 'incomplete') and carries no amount. Not checkout.session.completed
 * in subscription mode either, which deliberately grants nothing. stripe_events
 * already guarantees each event is handled once, so no extra guard is needed.
 */
async function welcome(admin: any, input: {
  userId: string
  email: string | null
  tier: Tier
  mode: 'pass' | 'subscription'
  period: 'month' | 'season' | null
  accessEndsAt: string | null
  amountCents: number | null | undefined
  currency: string | null | undefined
}) {
  await afterGrant('purchase event', () => recordPurchaseEvent(admin, {
    userId: input.userId,
    tier: input.tier,
    period: input.period,
    amountCents: input.amountCents,
    currency: input.currency,
  }))
  await afterGrant('welcome email', async () => {
    const result = await sendLifecycleEmail(input.email, welcomeMessage({
      tier: input.tier,
      mode: input.mode,
      accessEndsAt: input.accessEndsAt,
      amountCents: input.amountCents,
      currency: input.currency,
    }))
    if (!result.sent) console.error(`[stripe-webhook] welcome email not sent to ${input.userId}: ${result.error}`)
  })
}

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

  const admin = createAdminClient() as any

  // Layer 1: insert-first replay guard. A PK conflict means we already handled
  // this event, so stop before any grant logic runs.
  const { error: seenError } = await admin
    .from('stripe_events')
    .insert({ id: event.id, type: event.type })
  if (seenError) {
    // 23505 = unique_violation. Anything else is a real failure worth retrying.
    if ((seenError as any).code === '23505') {
      return NextResponse.json({ received: true, deduped: true })
    }
    console.error(`[stripe-webhook] stripe_events insert failed: ${seenError.message}`)
    return NextResponse.json({ error: 'Event log unavailable' }, { status: 500 })
  }

  const eventAt = new Date(event.created * 1000).toISOString()

  switch (event.type) {
    // ------------------------------------------------------------- one-time
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const priceId = session.metadata?.priceId ?? ''
      const customerId = (session.customer as string) ?? null
      if (!userId) return NextResponse.json({ received: true })

      const md = (session.metadata ?? {}) as Record<string, string | undefined>
      const existing = await profileById(admin, userId)

      // Catches buyers whose profile never got first-touch attribution stamped.
      const hasAttr = md.utm_source || md.utm_medium || md.utm_campaign || md.referrer
      const attrStamp = !existing?.attributed_at && hasAttr ? {
        utm_source: md.utm_source || null,
        utm_medium: md.utm_medium || null,
        utm_campaign: md.utm_campaign || null,
        first_referrer: md.referrer || null,
        landing_page: md.landing_page || null,
        attributed_at: new Date().toISOString(),
      } : {}

      if (session.mode === 'subscription') {
        // Deliberately does NOT grant. customer.subscription.created carries
        // the authoritative period end and writes the sub slot; granting here
        // too would duplicate the logic and race subscription materialisation.
        await admin.from('profiles').update({
          stripe_customer_id: customerId,
          ...attrStamp,
        }).eq('id', userId)
        break
      }

      const resolved = resolvePrice(priceId)
      if (!resolved) {
        // Fail loudly and grant NOTHING. The previous implementation fell back
        // to the cheapest tier, so a mis-set env var quietly sold the wrong
        // product to every buyer. A 500 makes Stripe retry once we fix it.
        console.error(`[stripe-webhook] Unrecognized priceId "${priceId}" on session ${session.id}; granting nothing`)
        return NextResponse.json({ error: 'Unrecognized price' }, { status: 500 })
      }

      // Layer 2 for the stacking path.
      if (existing?.last_stripe_session_id === session.id) {
        return NextResponse.json({ received: true, deduped: true })
      }

      const currentMs = existing?.pass_expires_at ? new Date(existing.pass_expires_at).getTime() : 0
      const passExpiresAt = passExpiryFrom(resolved.grant, currentMs, `session ${session.id}`)

      await recordPurchase(admin, {
        user_id: userId,
        stripe_session_id: session.id,
        price_id: priceId || null,
        tier: resolved.tier,
        kind: 'pass',
        amount_cents: session.amount_total ?? 0,
        currency: session.currency ?? 'usd',
        utm_source: md.utm_source || null,
        utm_medium: md.utm_medium || null,
        utm_campaign: md.utm_campaign || null,
        referrer: md.referrer || null,
        landing_page: md.landing_page || null,
      }, 'stripe_session_id')

      await admin.from('profiles').update({
        stripe_customer_id: customerId,
        pass_tier: resolved.tier,
        pass_expires_at: passExpiresAt,
        last_stripe_session_id: session.id,
        ...attrStamp,
      }).eq('id', userId)

      await recompute(admin, userId)
      // Awaited, not fired and forgotten: on Vercel the function can be frozen
      // the moment the response returns, which would drop an in-flight send.
      // notifyPayment never throws, so this cannot fail the grant above.
      await notifyPayment({
        kind: 'payment',
        email: existing?.email ?? session.customer_details?.email ?? null,
        tier: resolved.tier,
        amountCents: session.amount_total,
        currency: session.currency,
      })
      await welcome(admin, {
        userId,
        email: existing?.email ?? session.customer_details?.email ?? null,
        tier: resolved.tier,
        mode: 'pass',
        // 'until' is a season pass, 'days' the 30-day Portfolio.
        period: resolved.grant.kind === 'until' ? 'season' : resolved.grant.kind === 'days' ? 'month' : null,
        accessEndsAt: passExpiresAt,
        amountCents: session.amount_total,
        currency: session.currency,
      })
      break
    }

    // -------------------------------------------------------- subscriptions
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const profile = await resolveUser(admin, sub.metadata?.userId, (sub.customer as string) ?? null)
      if (!profile) {
        console.error(`[stripe-webhook] no profile for subscription ${sub.id} / customer ${sub.customer}`)
        break
      }

      // Layer 3: ignore an event older than the last one we applied.
      if (profile.sub_event_at && new Date(profile.sub_event_at).getTime() > event.created * 1000) {
        return NextResponse.json({ received: true, stale: true })
      }

      const priceId = subscriptionPriceId(sub)
      const tier: Tier | null = priceId ? (resolvePrice(priceId)?.tier ?? null) : null
      if (!tier) {
        console.error(`[stripe-webhook] unmapped price "${priceId}" on subscription ${sub.id}; leaving access unchanged`)
        break
      }

      const periodEnd = subscriptionPeriodEnd(sub)
      await admin.from('profiles').update({
        stripe_subscription_id: sub.id,
        sub_tier: tier,
        subscription_status: sub.status,
        sub_current_period_end: periodEnd ? new Date(periodEnd).toISOString() : null,
        sub_cancel_at_period_end: !!sub.cancel_at_period_end,
        sub_event_at: eventAt,
      }).eq('id', profile.id)

      await recompute(admin, profile.id)
      // Only the start. `updated` fires on every status churn and every card
      // change, which would bury the events worth reading.
      if (event.type === 'customer.subscription.created') {
        await notifyPayment({
          kind: 'subscription_started',
          email: profile.email ?? null,
          tier,
        })
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const profile = await resolveUser(admin, sub.metadata?.userId, (sub.customer as string) ?? null)
      if (!profile) break

      if (profile.sub_event_at && new Date(profile.sub_event_at).getTime() > event.created * 1000) {
        return NextResponse.json({ received: true, stale: true })
      }

      // Clears only the subscription slot. Any season pass the member also
      // holds is untouched and keeps them at its rung until it lapses.
      await admin.from('profiles').update({
        stripe_subscription_id: null,
        sub_tier: null,
        subscription_status: 'canceled',
        sub_current_period_end: null,
        sub_cancel_at_period_end: false,
        sub_event_at: eventAt,
      }).eq('id', profile.id)

      await recompute(admin, profile.id)
      await notifyPayment({
        kind: 'cancelled',
        email: profile.email ?? null,
        detail: 'Subscription slot cleared. Any season pass they also hold is untouched.',
      })
      break
    }

    // ------------------------------------------------------------- invoices
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const subId = invoiceSubscriptionId(invoice)
      if (!subId) break // one-off invoice, not a subscription cycle

      const profile = await profileByCustomer(admin, (invoice.customer as string) ?? null)
      if (!profile) {
        console.error(`[stripe-webhook] no profile for customer ${invoice.customer} on invoice ${invoice.id}`)
        break
      }

      let tier: Tier | null = null
      let priceId: string | null = null
      try {
        const sub = await getStripe().subscriptions.retrieve(subId)
        priceId = subscriptionPriceId(sub)
        tier = priceId ? (resolvePrice(priceId)?.tier ?? null) : null
      } catch (e: any) {
        console.error(`[stripe-webhook] could not retrieve subscription ${subId}: ${e?.message}`)
      }

      const periodEnd = invoicePeriodEnd(invoice)
      const update: Record<string, unknown> = { subscription_status: 'active' }
      if (tier) update.sub_tier = tier
      if (periodEnd) update.sub_current_period_end = new Date(periodEnd).toISOString()

      await admin.from('profiles').update(update).eq('id', profile.id)

      if (tier) {
        await recordPurchase(admin, {
          user_id: profile.id,
          stripe_invoice_id: invoice.id,
          price_id: priceId,
          tier,
          kind: 'subscription_cycle',
          amount_cents: invoice.amount_paid ?? 0,
          currency: invoice.currency ?? 'usd',
        }, 'stripe_invoice_id')
      }

      await notifyPayment({
        kind: 'renewal',
        email: profile.email ?? invoice.customer_email ?? null,
        tier,
        amountCents: invoice.amount_paid,
        currency: invoice.currency,
      })

      await recompute(admin, profile.id)

      // The first paid invoice of a new subscription. Renewals carry
      // 'subscription_cycle' and get no welcome; see welcome() for why this is
      // the one hook.
      if (tier && invoice.billing_reason === 'subscription_create') {
        await welcome(admin, {
          userId: profile.id,
          email: profile.email ?? invoice.customer_email ?? null,
          tier,
          mode: 'subscription',
          period: 'month',
          accessEndsAt: periodEnd ? new Date(periodEnd).toISOString() : null,
          amountCents: invoice.amount_paid,
          currency: invoice.currency,
        })
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const profile = await profileByCustomer(admin, (invoice.customer as string) ?? null)
      if (!profile) break

      // Access is NOT revoked here. Stripe's own smart retries handle recovery,
      // the member keeps the period they already paid for, and the 3-day grace
      // in recompute_entitlement() covers the dunning window. Cutting someone
      // off over a transient card decline is how you earn a chargeback.
      console.warn(`[stripe-webhook] payment failed for customer ${invoice.customer} on invoice ${invoice.id}`)
      await admin.from('profiles').update({ subscription_status: 'past_due' }).eq('id', profile.id)
      await recompute(admin, profile.id)

      // Ed hears about every attempt; the member hears once per invoice.
      // Stripe fires this event on each smart retry, and four "your card was
      // declined" emails in two weeks reads as harassment, not help.
      await afterGrant('payment-failed alert', async () => {
        await notifyPayment({
          kind: 'payment_failed',
          email: profile.email ?? invoice.customer_email ?? null,
          amountCents: invoice.amount_due,
          currency: invoice.currency,
          detail: `Invoice ${invoice.id}, attempt ${invoice.attempt_count ?? '?'}. Access left on; Stripe is retrying.`,
        })
      })
      await afterGrant('payment-failed email', async () => {
        // A declined FIRST invoice is a checkout the buyer watched fail on
        // Stripe's own page. They never had access, so "your access is still
        // on" would be false; Checkout already told them.
        if (invoice.billing_reason === 'subscription_create') return
        const claim = await claimEmail(admin, profile.id, 'payment_failed', invoice.id ?? 'unknown')
        if (claim === 'already-sent') return
        // Without email_log (migration not applied yet) fall back to the first
        // attempt only, which is the same "once per invoice" by another route.
        if (claim === 'unavailable' && (invoice.attempt_count ?? 1) > 1) return

        let tier: Tier | null = null
        const subId = invoiceSubscriptionId(invoice)
        if (subId) {
          try {
            const sub = await getStripe().subscriptions.retrieve(subId)
            const priceId = subscriptionPriceId(sub)
            tier = priceId ? (resolvePrice(priceId)?.tier ?? null) : null
          } catch {
            // The tier only names the plan in the copy; the email works without it.
          }
        }
        const result = await sendLifecycleEmail(
          profile.email ?? invoice.customer_email ?? null,
          paymentFailedMessage({ tier, amountCents: invoice.amount_due, currency: invoice.currency })
        )
        if (!result.sent) console.error(`[stripe-webhook] payment-failed email not sent to ${profile.id}: ${result.error}`)
      })
      break
    }

    // -------------------------------------------------------------- refunds
    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge
      const profile = await profileByCustomer(admin, (charge.customer as string) ?? null)
      if (!profile) break

      // Only a full refund revokes. A partial refund is usually a goodwill
      // gesture and should not strip access.
      if (charge.amount_refunded < charge.amount) {
        console.warn(`[stripe-webhook] partial refund on charge ${charge.id}; access left intact`)
        break
      }

      // Ends the pass slot now. A live subscription is untouched -- this is
      // precisely the case a single shared expiry column could not express.
      await admin.from('profiles').update({
        pass_expires_at: new Date().toISOString(),
      }).eq('id', profile.id)

      await recompute(admin, profile.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
