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
  // Held for a person, like page views, so crawlers do not inflate "seen".
  onFirstHumanSignal(() => {
    try {
      const key = `su_seen:${context}`
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { return }
    trackEvent('signup_prompt_view', { context })
  })
}

export function trackEvent(event: FunnelEvent, meta?: Record<string, unknown> | null): void {
  sendTrack({ path: window.location.pathname, event, meta: meta ?? null })
}

// ── Shared by every tracking call ───────────────────────────────────────────

/**
 * The ingest route. Not "/api/track": ad-block lists match paths like track,
 * analytics, collect and pixel, which silently dropped real visitors.
 * /api/track still works for anything cached on an old page.
 */
export const TRACK_URL = '/api/nav'

/** Set on any browser where an admin has signed in; that browser stops counting. */
export const ADMIN_FLAG_KEY = 'etsm_admin'
/** A random anonymous id, kept in the browser. No IP, no personal data. */
const VISITOR_KEY = 'etsm_vid'
/** This tab has shown a real person is here (scroll, pointer, key or touch). */
const HUMAN_KEY = 'etsm_human'

const LIVE_HOSTS = new Set(['edthestatman.com', 'www.edthestatman.com'])

/**
 * Whether this browser should report at all. Only the live site counts (local
 * dev servers and Vercel previews were writing into the production table),
 * never an automated browser, and never a browser an admin has used.
 */
export function canTrack(): boolean {
  try {
    if (!LIVE_HOSTS.has(window.location.hostname)) return false
    if ((navigator as any).webdriver) return false
    if (localStorage.getItem(ADMIN_FLAG_KEY) === '1') return false
    return true
  } catch {
    return false
  }
}

/** The anonymous visitor id, created on first use. Null when storage is blocked. */
export function visitorId(): string | null {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
      id = crypto.randomUUID()
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

/** Has this tab already shown a person is behind it? */
export function isHuman(): boolean {
  try { return sessionStorage.getItem(HUMAN_KEY) === '1' } catch { return false }
}

/**
 * Calls `then` once the visitor does something a person does: scroll, move
 * the pointer, touch or press a key. Scrapers that load pages and leave never
 * do, which is how one Singapore crawler made up 80% of November's "views".
 * Returns a cleanup function.
 */
export function onFirstHumanSignal(then: () => void): () => void {
  if (isHuman()) { then(); return () => {} }
  const events = ['pointermove', 'pointerdown', 'scroll', 'keydown', 'touchstart'] as const
  let done = false
  const fire = () => {
    if (done) return
    done = true
    try { sessionStorage.setItem(HUMAN_KEY, '1') } catch {}
    events.forEach(e => window.removeEventListener(e, fire, true))
    then()
  }
  events.forEach(e => window.addEventListener(e, fire, { capture: true, passive: true }))
  return () => { done = true; events.forEach(e => window.removeEventListener(e, fire, true)) }
}

/** POST to the ingest route with the visitor id attached. Never throws. */
export function sendTrack(body: Record<string, unknown>): Promise<any> {
  if (typeof window === 'undefined' || !canTrack()) return Promise.resolve(null)
  try {
    return fetch(TRACK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, vid: visitorId() }),
      keepalive: true,
    }).then(r => r.json()).catch(() => null)
  } catch {
    return Promise.resolve(null)
  }
}
