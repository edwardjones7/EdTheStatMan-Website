// Private admin channels — signups in one, money in another, for Ed only.
//
// Two webhooks, because they are two different questions. Signups are a stream
// you skim for growth; payments are a stream you want to feel. Splitting them
// also means each can ping a different role, or none.
//
// BOTH are separate from DISCORD_WEBHOOK_URL, and that separation is the point
// rather than tidiness: that one posts to the members channel, and everything
// here carries a customer's email address. Wiring either to the existing URL
// would publish the customer list to the audience.
//
// Nothing in this file ever throws. Both callers are flows that must not fail
// for a notification: the auth callback has a person waiting on a redirect, and
// the Stripe webhook answering non-2xx makes Stripe retry an event it has
// already applied. A missed alert is a smaller problem than either.

const BRAND_COLOR = 0x2dd4bf
const MONEY_COLOR = 0x22c55e
const CHURN_COLOR = 0xf8717a

type Field = { name: string; value: string; inline: boolean }

/** Cents to "$49.00". Stripe amounts are integers in the currency's minor unit. */
export function money(cents: number | null | undefined, currency = 'usd'): string {
  const n = (cents ?? 0) / 100
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(n)
  } catch {
    return `${n.toFixed(2)} ${currency.toUpperCase()}`
  }
}

/**
 * The two channels. Each resolves its own webhook and its own optional role, so
 * one can be live while the other is not, and payments can ping while signups
 * stay quiet.
 *
 * No fallback between them on purpose. A payments alert quietly appearing in
 * the signups channel because one variable was missing is worse than an alert
 * that does not arrive: the first is wrong and looks right.
 */
type Channel = 'signups' | 'payments'

const CHANNEL_ENV: Record<Channel, { url: string; role: string }> = {
  signups: { url: 'DISCORD_SIGNUPS_WEBHOOK_URL', role: 'DISCORD_SIGNUPS_ROLE_ID' },
  payments: { url: 'DISCORD_PAYMENTS_WEBHOOK_URL', role: 'DISCORD_PAYMENTS_ROLE_ID' },
}

async function post(channel: Channel, embed: Record<string, unknown>): Promise<{ sent: 0 | 1; error?: string }> {
  const env = CHANNEL_ENV[channel]
  const webhook = process.env[env.url]
  // Unset is the normal state locally and on any deployment that has not been
  // given the URL. Silence, not an error.
  if (!webhook) return { sent: 0 }

  // Optional, because an embed on its own pushes to nobody: Discord only
  // notifies a device when the mention sits in `content`. Without this the
  // alerts are still there, they just wait to be looked at.
  const roleId = process.env[env.role] || undefined

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: channel === 'signups' ? 'EdTheStatMan · signups' : 'EdTheStatMan · payments',
        content: roleId ? `<@&${roleId}>` : undefined,
        // Pins the blast radius to that one role, so an address or a name that
        // happens to contain @everyone can never ping the server.
        allowed_mentions: { parse: [], roles: roleId ? [roleId] : [] },
        embeds: [embed],
      }),
    })
    if (!res.ok) return { sent: 0, error: `${res.status} ${await res.text()}` }
    return { sent: 1 }
  } catch (e: any) {
    return { sent: 0, error: e?.message ?? 'fetch failed' }
  }
}

/** A verified new account. Fired from the auth callback, not from signup. */
export async function notifySignup(input: {
  email: string | null
  fullName?: string | null
  provider?: string | null
}): Promise<{ sent: 0 | 1; error?: string }> {
  const fields: Field[] = [{ name: 'Email', value: input.email || 'unknown', inline: true }]
  if (input.fullName) fields.push({ name: 'Name', value: input.fullName, inline: true })
  if (input.provider) fields.push({ name: 'Via', value: input.provider, inline: true })

  return post('signups', {
    title: 'New signup',
    description: 'Email verified, account is live.',
    color: BRAND_COLOR,
    fields,
    timestamp: new Date().toISOString(),
  })
}

export type PaymentKind = 'payment' | 'subscription_started' | 'renewal' | 'cancelled'

const PAYMENT_TITLE: Record<PaymentKind, string> = {
  payment: 'New payment',
  subscription_started: 'Subscription started',
  renewal: 'Renewal paid',
  cancelled: 'Subscription cancelled',
}

export async function notifyPayment(input: {
  kind: PaymentKind
  email: string | null
  tier?: string | null
  amountCents?: number | null
  currency?: string | null
  detail?: string | null
}): Promise<{ sent: 0 | 1; error?: string }> {
  const fields: Field[] = [{ name: 'Customer', value: input.email || 'unknown', inline: true }]
  if (input.tier) fields.push({ name: 'Tier', value: input.tier, inline: true })
  // Zero is a real amount on a cancellation and on a 100%-off invoice, so the
  // field is included only when an amount was actually passed.
  if (input.amountCents !== undefined && input.amountCents !== null) {
    fields.push({ name: 'Amount', value: money(input.amountCents, input.currency ?? 'usd'), inline: true })
  }
  if (input.detail) fields.push({ name: 'Detail', value: input.detail, inline: false })

  return post('payments', {
    title: PAYMENT_TITLE[input.kind],
    color: input.kind === 'cancelled' ? CHURN_COLOR : MONEY_COLOR,
    fields,
    timestamp: new Date().toISOString(),
  })
}
