'use client'

/**
 * Cloudflare Turnstile, for every form that makes Supabase SEND MAIL.
 *
 * WHY. From 11 to 14 Nov 2026 a headless browser on rotating datacenter IPs
 * (DE, NL, SE, DK, US) loaded /login about once an hour and asked for a
 * sign-in link for a harvested address, creating 45 accounts and mailing 45
 * strangers from our domain. It passed BotID's basic check (lib/botid-routes.ts).
 * Supabase's own CAPTCHA closes that path AND direct calls to the Auth API
 * with the public anon key, which no check on our server can see.
 *
 * HOW IT SWITCHES ON. With NEXT_PUBLIC_TURNSTILE_SITE_KEY unset this renders
 * nothing and getToken() resolves null, so the forms behave exactly as before.
 * Order of rollout: deploy with the key set, THEN enable CAPTCHA in Supabase
 * (Authentication > Attack Protection) with the secret. The other way round
 * rejects every sign-in.
 *
 * "Managed" mode with appearance interaction-only: most people never see it;
 * it only shows a checkbox when Cloudflare is unsure.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id: string) => void
    }
    __turnstileLoading?: Promise<void>
  }
}

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  if (window.__turnstileLoading) return window.__turnstileLoading
  window.__turnstileLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => { window.__turnstileLoading = undefined; reject(new Error('Turnstile failed to load')) }
    document.head.appendChild(s)
  })
  return window.__turnstileLoading
}

/**
 * `widget` goes inside the form. `getToken()` at submit waits (up to 15s) for
 * the check to finish; `reset()` after every submit, because a token works once.
 */
export function useTurnstile(action: string, onToken?: (t: string | null) => void) {
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken
  const slot = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const token = useRef<string | null>(null)
  const waiting = useRef<((t: string | null) => void)[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    let cancelled = false
    const settle = (t: string | null) => { token.current = t; onTokenRef.current?.(t); waiting.current.splice(0).forEach(w => w(t)) }
    loadScript()
      .then(() => {
        if (cancelled || !slot.current || !window.turnstile) return
        widgetId.current = window.turnstile.render(slot.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: 'dark',
          size: 'flexible',
          appearance: 'interaction-only',
          callback: (t: string) => { setFailed(false); settle(t) },
          'expired-callback': () => { token.current = null; onTokenRef.current?.(null); if (widgetId.current) window.turnstile?.reset(widgetId.current) },
          'error-callback': () => { setFailed(true); settle(null) },
        })
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [action])

  const getToken = useCallback((): Promise<string | null> => {
    if (!TURNSTILE_SITE_KEY) return Promise.resolve(null)
    if (token.current) return Promise.resolve(token.current)
    return new Promise(resolve => {
      waiting.current.push(resolve)
      window.setTimeout(() => resolve(token.current), 15_000)
    })
  }, [])

  const reset = useCallback(() => {
    token.current = null
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
  }, [])

  const widget = TURNSTILE_SITE_KEY ? <div ref={slot} className="turnstile-slot" /> : null
  return { widget, getToken, reset, failed }
}

/**
 * For a plain <form action={serverAction}>: the widget plus a hidden
 * `captchaToken` input the action reads. Submitting before the check finishes
 * sends no token, and the action's error says to wait for it.
 */
export function TurnstileField({ action }: { action: string }) {
  const [value, setValue] = useState('')
  const { widget } = useTurnstile(action, t => setValue(t ?? ''))
  if (!widget) return null
  return (
    <>
      {widget}
      <input type="hidden" name="captchaToken" value={value} />
    </>
  )
}
