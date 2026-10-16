'use client'

import { useEffect, useState } from 'react'
import { sendMagicLink } from '@/app/actions/auth'
import { authErrorMessage, type AuthErrorCode } from '@/lib/auth-errors'
import { trackEvent } from '@/lib/track-client'

/**
 * "Send it again", for the password-signup confirmation page.
 *
 * WHY A MAGIC LINK AND NOT supabase.auth.resend({ type: 'signup' }). Supabase's
 * resend endpoint takes no PKCE code challenge (auth-js sends none), so the
 * link it mails comes back with the session in the URL #fragment instead of a
 * `?code=`. /auth/callback is a server route and never sees a fragment, so that
 * click would confirm the address and then land on "sign-in failed". A magic
 * link to the same address does everything the resend would -- for an
 * unconfirmed account it is the confirmation -- and also signs them in.
 *
 * Goes through the sendMagicLink Server Action, so BotID applies; this page is
 * in BOTID_PROTECTED for that reason.
 *
 * Starts cooled down: the signup that brought them here sent a mail seconds
 * ago, and Supabase refuses another to the same address inside a minute.
 */
const COOLDOWN_S = 60

export default function ResendButton({ email, next }: { email: string; next: string }) {
  const [left, setLeft] = useState(COOLDOWN_S)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<AuthErrorCode | null>(null)

  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])

  async function resend() {
    setBusy(true)
    setError(null)
    const fd = new FormData()
    fd.set('email', email)
    fd.set('next', next)
    try {
      const result = await sendMagicLink(fd)
      if (result.ok) {
        setSent(true)
        trackEvent('magic_link_sent', { from: 'verify_resend' })
      } else {
        setError(result.error)
      }
    } catch {
      setError('auth')
    } finally {
      setBusy(false)
      setLeft(COOLDOWN_S)
    }
  }

  return (
    <div className="fd-resend" aria-live="polite">
      {sent && <div className="auth-success">Sent. The new link signs you straight in.</div>}
      {error && <div className="auth-error">{authErrorMessage(error)}</div>}
      <button
        type="button"
        className="btn btn--primary fd-btn-full"
        onClick={resend}
        disabled={busy || left > 0}
      >
        {busy ? 'Sending…' : left > 0 ? `Send a new link in ${left}s` : 'Send a new link'}
      </button>
    </div>
  )
}
