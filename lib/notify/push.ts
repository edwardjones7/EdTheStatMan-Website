// Web push channel (VAPID / Web Push Protocol).
//
// Subscriptions are per-browser, not per-user, so one member can hold several.
// Push services return 404/410 for endpoints that have been revoked — those are
// pruned on send, which is the only cleanup path the table gets.

import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'
import type { NotifiablePick, PickAudience, Recipient } from './audience'
import { renderPick } from './message'

const SEND_CHUNK = 50

let configured = false

/** Returns false when VAPID keys aren't set, so push degrades to a no-op. */
function configure(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return false

  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:ed@edthestatman.com',
      publicKey,
      privateKey
    )
    configured = true
  }
  return true
}

export async function sendPush(
  pick: NotifiablePick,
  audience: PickAudience,
  recipients: Recipient[]
): Promise<{ sent: number; pruned: number }> {
  if (!configure() || recipients.length === 0) return { sent: 0, pruned: 0 }

  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', recipients.map((r) => r.id))

  if (error) throw new Error(`Failed to load push subscriptions: ${error.message}`)

  const subs = (data ?? []) as Array<{ id: string; endpoint: string; p256dh: string; auth: string }>
  if (subs.length === 0) return { sent: 0, pruned: 0 }

  // Built field by field rather than spreading the rendered message: `detail`
  // must not ride along into a lock-screen notification.
  const { title, body, url } = renderPick(pick, audience)
  const payload = JSON.stringify({ title, body, url })

  let sent = 0
  const dead: string[] = []

  for (let i = 0; i < subs.length; i += SEND_CHUNK) {
    const chunk = subs.slice(i, i + SEND_CHUNK)
    const results = await Promise.allSettled(
      chunk.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        )
      )
    )

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        sent += 1
        return
      }
      const status = (result.reason as { statusCode?: number })?.statusCode
      // 404/410 mean the browser revoked this endpoint for good. Any other
      // failure is likely transient, so the subscription is left in place.
      if (status === 404 || status === 410) dead.push(chunk[idx].id)
    })
  }

  if (dead.length > 0) {
    await (admin as any).from('push_subscriptions').delete().in('id', dead)
  }

  return { sent, pruned: dead.length }
}
