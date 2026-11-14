'use client'

import type { FunnelEvent } from './funnel-events'

/**
 * Record a funnel event. Fire-and-forget: it must never block or break the
 * thing the visitor was doing, so every failure is swallowed.
 */
/** Cookie naming the last signup ask clicked; read when the account is created. */
export const PROMPT_COOKIE = 'su_prompt'

/**
 * A click on a signup ask: the event, plus a day-long cookie naming the
 * placement, so signup_complete (recorded server side in the auth callback)
 * can say which ask brought the account in.
 */
export function trackPromptClick(context: string, variant: string): void {
  trackEvent('signup_prompt_click', { context, variant })
  try {
    document.cookie = `${PROMPT_COOKIE}=${encodeURIComponent(context.slice(0, 60))}; max-age=86400; path=/; samesite=lax`
  } catch {}
}

/**
 * A signup ask was seen. Once per browser session per placement: the funnel
 * needs "how many people saw it", not "how many renders", and every row is a
 * database write.
 */
export function trackPromptView(context: string): void {
  try {
    const key = `su_seen:${context}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch { return }
  trackEvent('signup_prompt_view', { context })
}

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
