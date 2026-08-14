// Fan-out dispatcher for "a pick just dropped".
//
// Contract: this never throws. A pick insert must succeed even if Discord is
// down, Resend rejects the key, or the VAPID keys are missing — the pick is the
// product, the notification is a courtesy. Channels are isolated from each
// other for the same reason.

import { audienceForPick, recipientsFor, type NotifiablePick } from './audience'
import { sendDiscord } from './discord'
import { sendEmail } from './email'
import { sendPush } from './push'

export type { NotifiablePick } from './audience'

export interface NotifyResult {
  skipped?: string
  audience?: string
  discord?: { sent: number; mentioned: string | null } | { error: string }
  email?: { sent: number; failed: number; errors?: string[] } | { error: string }
  push?: { sent: number; pruned: number } | { error: string }
}

/** Global off switch. Set NOTIFICATIONS_ENABLED=false to silence every channel. */
function enabled(): boolean {
  return process.env.NOTIFICATIONS_ENABLED !== 'false'
}

async function guard<T>(label: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[notify] ${label} failed:`, message)
    return { error: message }
  }
}

export async function notifyNewPick(pick: NotifiablePick): Promise<NotifyResult> {
  if (!enabled()) return { skipped: 'notifications disabled' }
  // An inactive pick isn't visible on the site yet, so announcing it would send
  // members to a page that doesn't show it.
  if (pick.is_active === false) return { skipped: 'pick is not active' }

  const audience = audienceForPick(pick)
  // Elite picks notify nobody until the elite tier is fully integrated. Bailing
  // before Discord matters: the Discord channel has no tier separation, so an
  // elite post there would reach everyone.
  if (audience === null) return { skipped: 'elite picks do not notify yet' }

  // Recipients drive both email and push; Discord doesn't need them and still
  // fires if this lookup fails.
  const recipients = await guard('recipients', () => recipientsFor(audience))
  const list = Array.isArray(recipients) ? recipients : []

  const [discord, email, push] = await Promise.all([
    guard('discord', () => sendDiscord(pick, audience)),
    guard('email', () => sendEmail(pick, audience, list)),
    guard('push', () => sendPush(pick, audience, list)),
  ])

  return { audience, discord, email, push }
}
