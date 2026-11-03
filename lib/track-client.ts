'use client'

import type { FunnelEvent } from './funnel-events'

/**
 * Record a funnel event. Fire-and-forget: it must never block or break the
 * thing the visitor was doing, so every failure is swallowed.
 */
export function trackEvent(event: FunnelEvent, meta?: Record<string, unknown> | null): void {
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: window.location.pathname, event, meta: meta ?? null }),
      keepalive: true,
    }).catch(() => {})
  } catch {}
}
