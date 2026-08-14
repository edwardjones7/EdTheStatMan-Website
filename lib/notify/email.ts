// Email channel, via the Resend account the contact form already uses.
//
// Sends are individually addressed (never a shared To/BCC) so one member can
// never see another's address. Resend's batch endpoint caps at 100 messages per
// call, so the list is chunked.

import { Resend } from 'resend'
import type { NotifiablePick, PickAudience, Recipient } from './audience'
import { renderPick, SITE_URL } from './message'

const FROM = 'EdTheStatMan Picks <noreply@edthestatman.com>'
/**
 * Resend's batch endpoint caps at 100 messages per call. Overridable only so the
 * multi-chunk path can be exercised against a short list — leave it unset in
 * production.
 */
const BATCH_LIMIT = Number(process.env.RESEND_BATCH_LIMIT) || 100
/** Resend allows ~2 requests/sec; pause between chunks to stay under it. */
const CHUNK_DELAY_MS = 600
const MAX_ATTEMPTS = 4

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Resend surfaces rate limits inconsistently across versions — check all three. */
function isRateLimit(error: { name?: string; statusCode?: number; message?: string }): boolean {
  return (
    error?.statusCode === 429 ||
    error?.name === 'rate_limit_exceeded' ||
    /rate.?limit|too many requests/i.test(error?.message ?? '')
  )
}

function unsubscribeUrl(token: string): string {
  return `${SITE_URL}/api/notifications/unsubscribe?token=${encodeURIComponent(token)}`
}

// Site palette, hard-coded: email clients can't read CSS custom properties.
const C = {
  bg: '#071219',
  card: '#0c1e28',
  border: '#12293a',
  teal: '#2dd4bf',
  gold: '#e9c46a',
  heading: '#f4fafc',
  text: '#dbe7ec',
  secondary: '#93a8b3',
  muted: '#5f7783',
}

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

/**
 * Table-based with inlined styles throughout — Outlook ignores <div> layout and
 * strips <style> blocks, so this is the only structure that survives everywhere.
 */
function html(
  title: string,
  body: string,
  url: string,
  unsub: string,
  audience: PickAudience
): string {
  const isFree = audience === 'everyone'
  const badgeText = isFree ? 'FREE PICK' : 'MEMBERS ONLY'
  const badgeColor = isFree ? C.teal : C.gold

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};">
<!-- Inbox preview line; hidden in the body itself. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${body}</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.bg};padding:32px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

        <!-- Wordmark -->
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <a href="${url}" style="text-decoration:none;">
              <span style="font-family:${FONT};font-size:19px;font-weight:700;letter-spacing:.5px;color:${C.heading};">Ed<span style="color:${C.teal};">The</span>StatMan</span>
            </a>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background-color:${C.card};border:1px solid ${C.border};border-top:3px solid ${badgeColor};border-radius:10px;padding:36px 32px;">

            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="background-color:${badgeColor};border-radius:20px;padding:5px 13px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1px;color:${C.bg};">${badgeText}</td>
              </tr>
            </table>

            <p style="margin:20px 0 0;font-family:${FONT};font-size:25px;line-height:1.25;font-weight:700;color:${C.heading};">${title}</p>
            <p style="margin:14px 0 0;font-family:${FONT};font-size:16px;line-height:1.6;color:${C.secondary};">${body}</p>

            <!-- Bulletproof CTA: padding sits on the <a>, not the cell. -->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:30px;">
              <tr>
                <td align="center" bgcolor="${C.teal}" style="border-radius:7px;">
                  <a href="${url}" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.bg};text-decoration:none;border-radius:7px;">View the pick &rarr;</a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding:26px 20px 0;">
            <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.muted};">
              You're getting this because you have an EdTheStatMan account.<br>
              <a href="${unsub}" style="color:${C.secondary};text-decoration:underline;">Unsubscribe from pick alerts</a>
              &nbsp;&middot;&nbsp;
              <a href="${url}" style="color:${C.secondary};text-decoration:underline;">edthestatman.com</a>
            </p>
            <p style="margin:14px 0 0;font-family:${FONT};font-size:11px;line-height:1.5;color:${C.muted};">
              21+. Please wager responsibly. Nothing here is financial advice.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export async function sendEmail(
  pick: NotifiablePick,
  audience: PickAudience,
  recipients: Recipient[]
): Promise<{ sent: number; failed: number; errors?: string[] }> {
  if (!process.env.RESEND_API_KEY) return { sent: 0, failed: 0 }

  const optedIn = recipients.filter((r) => r.emailOptIn)
  if (optedIn.length === 0) return { sent: 0, failed: 0 }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { title, body, url } = renderPick(pick, audience)

  let sent = 0
  let failed = 0
  const errors: string[] = []

  for (let i = 0; i < optedIn.length; i += BATCH_LIMIT) {
    const chunk = optedIn.slice(i, i + BATCH_LIMIT)

    // Space the calls out. A free pick is 2+ chunks today and grows with the
    // list, and back-to-back calls are what trips the rate limit.
    if (i > 0) await sleep(CHUNK_DELAY_MS)

    let lastError = ''
    let delivered = false

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const { error } = await resend.batch.send(
        chunk.map((r) => ({
          from: FROM,
          to: r.email,
          subject: title,
          text: `${body}\n\nView it: ${url}\n\nUnsubscribe: ${unsubscribeUrl(r.notifyToken)}`,
          html: html(title, body, url, unsubscribeUrl(r.notifyToken), audience),
          headers: {
            // Lets Gmail/Apple Mail show a native unsubscribe control, which
            // keeps pick alerts out of the spam folder as the list grows.
            'List-Unsubscribe': `<${unsubscribeUrl(r.notifyToken)}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        }))
      )

      if (!error) {
        delivered = true
        break
      }

      lastError = error.message
      // Only rate limits are worth retrying; a bad key or malformed payload
      // will fail identically every time.
      if (!isRateLimit(error as any) || attempt === MAX_ATTEMPTS) break

      const backoff = CHUNK_DELAY_MS * 2 ** attempt
      console.warn(`[notify] Resend rate limited, retrying in ${backoff}ms (attempt ${attempt}/${MAX_ATTEMPTS})`)
      await sleep(backoff)
    }

    if (delivered) {
      sent += chunk.length
    } else {
      // Carry on to the remaining chunks rather than aborting — one bad chunk
      // shouldn't cost everyone further down the list their alert.
      failed += chunk.length
      errors.push(`chunk ${i / BATCH_LIMIT + 1}: ${lastError}`)
      console.error(`[notify] email chunk failed for ${chunk.length} recipients: ${lastError}`)
    }
  }

  return errors.length > 0 ? { sent, failed, errors } : { sent, failed }
}
