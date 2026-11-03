'use client'

import { useState } from 'react'
import { authErrorMessage, type AuthErrorCode } from '@/lib/auth-errors'
import { trackEvent } from '@/lib/track-client'

/**
 * The form state behind every free-picks box. `from` labels the funnel events
 * so the homepage band and the footer can be compared.
 *
 * There is no separate mailing list. A free account IS the email list: see the
 * note in HomeFreePicks.tsx. The POST goes to /api/free-picks, not a Server
 * Action, for the reason given in that route.
 */
export function useFreePicksSignup(from: string) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')
    setError(null)
    trackEvent('signup_start', { method: 'magic_link', from })
    try {
      const res = await fetch('/api/free-picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = (await res.json()) as { ok: true } | { ok: false; error: AuthErrorCode }
      if (result.ok) {
        trackEvent('magic_link_sent', { from })
        setState('sent')
      } else {
        setError(authErrorMessage(result.error))
        setState('idle')
      }
    } catch {
      setError(authErrorMessage('auth'))
      setState('idle')
    }
  }

  return { state, error, email, setEmail, submit }
}
