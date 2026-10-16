// Transactional mail about a member's own purchase: the welcome, a failed
// payment, a pass about to end, and one note after it has ended.
//
// Separate from email.ts on purpose. That file is a broadcast (one pick, two
// lists, chunked batch sends, an opt-in filter). These are one message to one
// person about money they spent, so they go out regardless of the pick-alert
// toggle -- with the single exception of the win-back, which is a sales note
// and honours notify_email like any other marketing.
//
// NOTHING HERE THROWS. Every caller is either the Stripe webhook (where a throw
// means a non-2xx and Stripe retrying an event whose grant already landed) or
// the lifecycle cron (where one bad address must not stop the rest). A missed
// email is the smaller failure.
//
// Copy rules, same as the site: plain, specific, no hype, no promises about
// results. Say what was bought, when it ends, and where to go next.

import { Resend } from 'resend'
import { C, FONT, FROM, complianceFooterHtml, complianceFooterText, unsubscribeUrl } from './email'
import { siteUrl } from '@/lib/site-url'
import { TIER_LABEL, normalizeTier, type Tier } from '@/lib/access'
import { money } from './admin'

export type LifecycleKind =
  | 'welcome'
  | 'payment_failed'
  | 'pass_expiring_7d'
  | 'pass_expiring_1d'
  | 'pass_expired'

interface Link { label: string; href: string }

export interface LifecycleMessage {
  subject: string
  /** Inbox preview line. */
  preview: string
  heading: string
  /** Plain text paragraphs. Escaped on the way into HTML. */
  paragraphs: string[]
  /** Secondary destinations, rendered as a short list under the copy. */
  links: Link[]
  cta: Link
  /** Shown as the badge. Gold for paid status, coral for a problem. */
  badge: string
  tone: 'paid' | 'problem'
  /** Only the win-back carries one; transactional mail is not unsubscribable. */
  unsubscribeToken?: string | null
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Dates in Eastern, because that is the timezone every kickoff on the site is
 * shown in, and a pass that ends "February 15" in UTC must not read as the
 * 14th to the member.
 */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return 'the end of your current period'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'the end of your current period'
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function url(path: string): string {
  return `${siteUrl()}${path}`
}

/**
 * Where this rung's product lives. Highest first, because the first link is
 * what a new member most likely paid for.
 */
function productLinks(tier: Tier): Link[] {
  const links: Link[] = []
  if (tier === 'private' || tier === 'institutional') {
    links.push({ label: 'The Vault: every system and trend', href: url('/vault') })
  }
  if (tier === 'desk' || tier === 'private' || tier === 'institutional') {
    links.push({ label: 'The Research Desk: this week in the NFL', href: url('/desk/nfl') })
  }
  links.push({ label: 'The Portfolio: today\'s picks and the graded record', href: url('/portfolio') })
  return links
}

/** The renew link for a pass. /win reads `checkout` + `period` to resume a plan. */
function renewHref(tier: Tier): string {
  return url(`/win?checkout=${encodeURIComponent(tier)}&period=season`)
}

// ------------------------------------------------------------------ templates

export function welcomeMessage(input: {
  tier: string
  mode: 'pass' | 'subscription'
  /** Pass: when access ends. Subscription: the next renewal date. */
  accessEndsAt: string | null
  amountCents?: number | null
  currency?: string | null
}): LifecycleMessage {
  const tier = normalizeTier(input.tier)
  const name = TIER_LABEL[tier]
  const paid = input.amountCents != null ? ` (${money(input.amountCents, input.currency ?? 'usd')})` : ''

  const term = input.mode === 'subscription'
    ? `Your plan renews on ${formatDay(input.accessEndsAt)} and bills monthly until you cancel. You can cancel at any time from your account, and you keep access to the end of the period you have paid for.`
    : `Your access runs through ${formatDay(input.accessEndsAt)}. This was a one-time payment. It does not renew, so there is nothing to cancel.`

  return {
    subject: `You're in: ${name}`,
    preview: `Your ${name} access is on. Here is where everything is.`,
    heading: `Welcome to ${name}`,
    paragraphs: [
      `Thanks for your purchase${paid}. Your access is on now.`,
      term,
      'New picks are announced the moment they are posted, by email, browser push and Discord. Email is on by default. Push and the Discord Members role are one click each on your account page.',
    ],
    links: [
      ...productLinks(tier),
      { label: 'Your account: alerts, Discord and billing', href: url('/account') },
    ],
    cta: { label: 'Turn on alerts', href: url('/account') },
    badge: name.toUpperCase(),
    tone: 'paid',
  }
}

export function paymentFailedMessage(input: {
  tier: string | null
  amountCents?: number | null
  currency?: string | null
}): LifecycleMessage {
  const name = input.tier ? TIER_LABEL[normalizeTier(input.tier)] : 'your membership'
  const amount = input.amountCents != null ? ` of ${money(input.amountCents, input.currency ?? 'usd')}` : ''
  return {
    subject: 'Your payment did not go through',
    preview: 'Your access is still on. Update your card to keep it that way.',
    heading: 'We could not take your payment',
    paragraphs: [
      `Your card was declined for the monthly payment${amount} for ${name}.`,
      'Your access is still on. Stripe will retry the card automatically over the next few days, but if the card has expired or changed, those retries will fail too.',
      'To fix it now, open your account and choose Manage Subscription. That opens Stripe\'s secure billing page, where you can update the card.',
    ],
    links: [],
    cta: { label: 'Update your card', href: url('/account') },
    badge: 'BILLING',
    tone: 'problem',
  }
}

export function passExpiringMessage(input: {
  tier: string
  expiresAt: string
  daysLeft: 7 | 1
  /**
   * True when this is the season pass reaching the end of the season. There is
   * nothing to renew into then -- a season pass bought after SEASON_ENDS_AT is
   * a 30-day fallback -- so the note says so instead of pitching one.
   */
  seasonOver?: boolean
}): LifecycleMessage {
  const tier = normalizeTier(input.tier)
  const name = TIER_LABEL[tier]
  const when = input.daysLeft === 1 ? 'tomorrow' : 'in a week'
  const ends = `Your ${name} pass runs through ${formatDay(input.expiresAt)}. It was a one-time payment, so it simply stops then. Nothing will be charged.`
  if (input.seasonOver) {
    return {
      subject: `Your ${name} access ends ${when}`,
      preview: `Access runs through ${formatDay(input.expiresAt)}.`,
      heading: `Your access ends ${when}`,
      paragraphs: [ends, 'That is the end of the season. Thank you for being with us for it.'],
      links: productLinks(tier),
      cta: { label: 'See the season record', href: url('/portfolio/performance') },
      badge: name.toUpperCase(),
      tone: 'paid',
    }
  }
  return {
    subject: `Your ${name} access ends ${when}`,
    preview: `Access runs through ${formatDay(input.expiresAt)}.`,
    heading: `Your access ends ${when}`,
    paragraphs: [
      ends,
      // Season grants take max(current expiry, season end), so this is true:
      // buying early never shortens what is left.
      'If you want to keep going, the season pass runs through the Super Bowl. Buying it before then extends your access to that date, so you do not lose the days you have left.',
    ],
    links: productLinks(tier),
    cta: { label: 'See the season pass', href: renewHref(tier) },
    badge: name.toUpperCase(),
    tone: 'paid',
  }
}

export function passExpiredMessage(input: {
  tier: string
  expiredAt: string
  unsubscribeToken?: string | null
}): LifecycleMessage {
  const tier = normalizeTier(input.tier)
  const name = TIER_LABEL[tier]
  return {
    subject: `Your ${name} access has ended`,
    preview: 'Your account and history are still here.',
    heading: 'Your access has ended',
    paragraphs: [
      `Your ${name} pass ended on ${formatDay(input.expiredAt)}. Your account is still here, along with the free picks, the free systems and trends, and the record on everything else.`,
      'If you want back in, the season pass runs through the Super Bowl and is a single payment. This is the only note we will send about it.',
    ],
    links: [{ label: 'The graded record', href: url('/portfolio/performance') }],
    cta: { label: 'See the season pass', href: renewHref(tier) },
    badge: 'MEMBERSHIP',
    tone: 'paid',
    unsubscribeToken: input.unsubscribeToken ?? null,
  }
}

// ------------------------------------------------------------------ rendering

/** Table-based and inline-styled, for the same reasons as email.ts. */
export function renderLifecycleHtml(m: LifecycleMessage): string {
  const accent = m.tone === 'problem' ? '#f8717a' : C.gold
  const home = siteUrl()
  const paragraphs = m.paragraphs
    .map((p, i) => `<p style="margin:${i === 0 ? '14px' : '12px'} 0 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.secondary};">${esc(p)}</p>`)
    .join('\n            ')
  const links = m.links.length === 0 ? '' : `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
              ${m.links.map((l) => `<tr><td style="padding:5px 0;font-family:${FONT};font-size:15px;line-height:1.5;"><a href="${esc(l.href)}" style="color:${C.teal};text-decoration:underline;">${esc(l.label)}</a></td></tr>`).join('\n              ')}
            </table>`
  const unsub = m.unsubscribeToken
    ? `<br><a href="${esc(unsubscribeUrl(m.unsubscribeToken))}" style="color:${C.secondary};text-decoration:underline;">Unsubscribe from marketing email</a>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${esc(m.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(m.preview)}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.bg};padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

        <tr>
          <td align="center" style="padding-bottom:24px;">
            <a href="${esc(home)}" style="text-decoration:none;">
              <span style="font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:.5px;color:${C.heading};">Ed<span style="color:${C.teal};">The</span>StatMan</span>
            </a>
          </td>
        </tr>

        <tr>
          <td style="background-color:${C.card};border:1px solid ${C.border};border-top:3px solid ${accent};border-radius:10px;padding:36px 32px;">

            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:${accent};border-radius:20px;padding:5px 13px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1px;color:${C.bg};">${esc(m.badge)}</td>
              </tr>
            </table>

            <p style="margin:20px 0 0;font-family:${FONT};font-size:25px;line-height:1.25;font-weight:700;color:${C.heading};">${esc(m.heading)}</p>
            ${paragraphs}
            ${links}

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
              <tr>
                <td align="center" bgcolor="${C.teal}" style="border-radius:7px;">
                  <a href="${esc(m.cta.href)}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.bg};text-decoration:none;border-radius:7px;">${esc(m.cta.label)} &rarr;</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <tr>
          <td align="center" style="padding:26px 20px 0;">
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">
              You're getting this because of a purchase on your EdTheStatMan account.${unsub}
              <br><a href="${esc(home)}" style="color:${C.secondary};text-decoration:underline;">edthestatman.com</a>
            </p>
            ${complianceFooterHtml()}
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function renderLifecycleText(m: LifecycleMessage): string {
  const parts = [
    m.heading,
    ...m.paragraphs,
    ...(m.links.length ? [m.links.map((l) => `${l.label}: ${l.href}`).join('\n')] : []),
    `${m.cta.label}: ${m.cta.href}`,
    ...(m.unsubscribeToken ? [`Unsubscribe: ${unsubscribeUrl(m.unsubscribeToken)}`] : []),
    complianceFooterText(),
  ]
  return parts.join('\n\n')
}

/**
 * Send one lifecycle message. Never throws; reports the outcome instead.
 * A missing RESEND_API_KEY is a silent skip, the same as the pick alerts.
 */
export async function sendLifecycleEmail(
  to: string | null | undefined,
  m: LifecycleMessage
): Promise<{ sent: boolean; error?: string }> {
  if (!to) return { sent: false, error: 'no address' }
  if (!process.env.RESEND_API_KEY) return { sent: false, error: 'RESEND_API_KEY unset' }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const headers: Record<string, string> = {}
    if (m.unsubscribeToken) {
      headers['List-Unsubscribe'] = `<${unsubscribeUrl(m.unsubscribeToken)}>`
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
    }
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: m.subject,
      html: renderLifecycleHtml(m),
      text: renderLifecycleText(m),
      ...(Object.keys(headers).length ? { headers } : {}),
    })
    if (error) return { sent: false, error: error.message }
    return { sent: true }
  } catch (e: any) {
    return { sent: false, error: e?.message ?? 'send failed' }
  }
}
