/* Service worker for pick alerts.
 *
 * Served from /sw.js so its scope is the whole origin. Payloads are produced by
 * renderPick() in lib/notify/message.ts: { title, body, url }.
 */

// A new worker normally sits in "waiting" until every tab using the old one is
// closed, so a change to this file wouldn't reach anyone for days. These two
// hand control to the new version straight away.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (err) {
    payload = { title: 'EdTheStatMan', body: 'A new pick is live.' }
  }

  const title = payload.title || 'EdTheStatMan'
  const options = {
    body: payload.body || 'A new pick is live.',
    icon: '/logo.png',
    badge: '/logo.png',
    data: { url: payload.url || '/model-picks' },
    // Collapses rapid-fire alerts into one entry per slate on the lock screen.
    tag: 'ets-pick',
    // With `tag` set, a repeat would replace the previous notification silently.
    // renotify forces it to alert again — without this, pick 2 of a slate lands
    // with no sound at all.
    renotify: true,
    // The Notifications API has no way to supply a custom sound — the `sound`
    // property was dropped from the spec and no browser implements it. The ding
    // is the OS notification sound, set per-app in Windows notification
    // settings. All we can do is not suppress it.
    silent: false,
    // Hold the toast open until it's dismissed rather than auto-hiding after a
    // few seconds. Best-effort: Windows may still route it to Notification
    // Center on its own schedule.
    requireInteraction: true,
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/model-picks'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reuse an already-open tab rather than stacking duplicates.
      for (const client of clientList) {
        if (client.url.includes('/model-picks') && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    })
  )
})
