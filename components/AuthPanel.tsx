'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { sendMagicLink, signInWithPassword, signUpWithPassword } from '@/app/actions/auth'
import { createClient } from '@/lib/supabase/client'
import { authErrorMessage, type AuthErrorCode } from '@/lib/auth-errors'
import { trackEvent } from '@/lib/track-client'
import { IconMail } from './Icons'
import '@/styles/front-door.css'

/**
 * Sign up and sign in, one component, three ways in, in this order:
 *
 *   1. Continue with Google        one tap, nothing to remember
 *   2. Email me a link             one field; the click confirms AND signs in
 *   3. Use a password instead      behind a disclosure, for people who want one
 *
 * WHY THIS ORDER. Decisions 2026-10-15: the main ask is a free account made
 * nearly frictionless, and the old flow (two password fields, then a verify
 * wall before anything worked) was the friction. Both of the first two paths
 * prove the address in the same step that creates the account, so there is no
 * separate "verify your email" stop on them, and the account is confirmed --
 * which is what pick notifications require (lib/notify/audience.ts).
 *
 * `next` rides along every path: Google's redirectTo, the magic link's
 * emailRedirectTo (set server side in sendMagicLink), the password forms, and
 * the links between /signup and /login.
 */

/**
 * Seconds before "Resend" works again. 60, not 30: Supabase's default
 * per-address limit is one OTP email a minute, and a resend inside that window
 * fails with a "for security purposes" error. Matching it means the button is
 * never live when the send would be refused.
 */
const RESEND_COOLDOWN_S = 60

const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'One lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { key: 'symbol', label: 'One symbol (!@#$…)', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.96L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

/** A countdown that ticks to zero once a second. */
function useCooldown() {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return [left, () => setLeft(RESEND_COOLDOWN_S)] as const
}

interface Props {
  mode: 'signup' | 'login'
  /** Validated relative path to land on afterwards. */
  next: string
  /** Prefill, e.g. from /signup/verify's "use a link instead". */
  initialEmail?: string
}

export default function AuthPanel({ mode, next, initialEmail = '' }: Props) {
  const [email, setEmail] = useState(initialEmail)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'google' | 'link' | 'password'>(null)
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [cooldown, startCooldown] = useCooldown()
  const [showPassword, setShowPassword] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  const isSignup = mode === 'signup'

  async function handleGoogle() {
    setError(null)
    setBusy('google')
    if (isSignup) trackEvent('signup_start', { method: 'google' })
    const supabase = createClient()
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    // On success the browser is already navigating to Google; only a failure
    // to even start the redirect comes back here.
    if (oauthError) {
      setError('google')
      setBusy(null)
    }
  }

  async function requestLink(address: string) {
    setError(null)
    setBusy('link')
    const fd = new FormData()
    fd.set('email', address)
    fd.set('next', next)
    try {
      const result = await sendMagicLink(fd)
      if (result.ok) {
        setSentTo(address)
        startCooldown()
        trackEvent('magic_link_sent', { from: mode })
      } else {
        setError(result.error)
        // The address is in Supabase's cooldown already; mirror it so the next
        // press is one that can succeed.
        if (result.error === 'wait') startCooldown()
      }
    } catch {
      setError('auth')
    } finally {
      setBusy(null)
    }
  }

  // Move focus to the "check your inbox" panel when it appears, so a screen
  // reader announces it and a keyboard user is not left on a vanished button.
  useEffect(() => {
    if (sentTo) statusRef.current?.focus()
  }, [sentTo])

  function handleLinkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy || cooldown > 0) return
    if (isSignup) trackEvent('signup_start', { method: 'magic_link' })
    requestLink(email.trim())
  }

  // ---- "Check your inbox" ----------------------------------------------------
  if (sentTo) {
    return (
      <div className="fd-sent" role="status" aria-live="polite" ref={statusRef} tabIndex={-1}>
        <div className="verify-icon"><IconMail size={28} /></div>
        <h2 className="fd-sent__title">Check your inbox</h2>
        <p className="fd-sent__text">
          We sent a sign-in link to <strong>{sentTo}</strong>. Open it on this device
          and you are in{isSignup ? ', account created' : ''}. It works once and
          expires in an hour.
        </p>
        <p className="fd-sent__hint">Nothing after a minute? Check spam or promotions.</p>

        {error && <div className="auth-error">{authErrorMessage(error)}</div>}

        <button
          type="button"
          className="btn btn--outline fd-btn-full"
          onClick={() => requestLink(sentTo)}
          disabled={busy !== null || cooldown > 0}
        >
          {busy === 'link' ? 'Sending…' : cooldown > 0 ? `Resend link in ${cooldown}s` : 'Resend link'}
        </button>
        <button
          type="button"
          className="fd-textbtn"
          onClick={() => { setSentTo(null); setError(null) }}
        >
          Use a different email
        </button>
      </div>
    )
  }

  // ---- Start ---------------------------------------------------------------
  return (
    <div className="auth-form fd-panel">
      <button
        type="button"
        className="btn btn--google fd-google"
        onClick={handleGoogle}
        disabled={busy !== null}
      >
        <GoogleMark />
        {busy === 'google' ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <div className="auth-divider"><span>or</span></div>

      <form onSubmit={handleLinkSubmit}>
        <div className="form-group">
          <label htmlFor="fd-email">Email</label>
          <input
            id="fd-email"
            name="email"
            type="email"
            inputMode="email"
            className="form-input fd-input"
            placeholder="you@example.com"
            required
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>

        <div aria-live="polite" className="fd-status">
          {error && !showPassword && <div className="auth-error">{authErrorMessage(error)}</div>}
        </div>

        <button
          type="submit"
          className="btn btn--primary fd-btn-full"
          disabled={busy !== null || cooldown > 0}
        >
          {busy === 'link'
            ? 'Sending…'
            : cooldown > 0
              ? `Try again in ${cooldown}s`
              : isSignup ? 'Email me a sign-up link' : 'Email me a sign-in link'}
        </button>
        <p className="fd-fineprint">No password needed. We email you a link that signs you in.</p>
      </form>

      <button
        type="button"
        className="fd-disclosure"
        aria-expanded={showPassword}
        aria-controls="fd-password-panel"
        onClick={() => { setShowPassword(v => !v); setError(null) }}
      >
        {showPassword ? 'Hide password option' : 'Use a password instead'}
      </button>

      {showPassword && (
        <div id="fd-password-panel" className="fd-password">
          {isSignup
            ? <PasswordSignup email={email} setEmail={setEmail} next={next} />
            : <PasswordLogin email={email} setEmail={setEmail} next={next} />}
        </div>
      )}
    </div>
  )
}

// ---- Password, the secondary path ------------------------------------------

function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="input-reveal__btn fd-reveal" onClick={onToggle} aria-label={shown ? 'Hide password' : 'Show password'}>
      {shown ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  )
}

interface PasswordProps {
  email: string
  setEmail: (v: string) => void
  next: string
}

/**
 * One password field with a show toggle, not the old password + confirm pair:
 * the toggle catches the typo the second field was there for, at half the
 * typing. Confirmation by email still applies to this path (see
 * signUpWithPassword), which is why it is the secondary one.
 */
function PasswordSignup({ email, setEmail, next }: PasswordProps) {
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const allPass = PASSWORD_RULES.every(r => r.test(password))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!allPass) { setTouched(true); setError('weak'); return }
    setBusy(true)
    trackEvent('signup_start', { method: 'password' })
    const fd = new FormData()
    fd.set('email', email.trim())
    fd.set('password', password)
    fd.set('next', next)
    try {
      // Success redirects (to /signup/verify, or straight to `next` when the
      // project does not require confirmation); only failures return.
      const result = await signUpWithPassword(fd)
      if (result && !result.ok) setError(result.error)
    } catch (err) {
      // A redirect from a Server Action surfaces as a thrown NEXT_REDIRECT in
      // some versions; let the router handle it rather than showing an error.
      if (err && typeof err === 'object' && 'digest' in err && String((err as any).digest).startsWith('NEXT_REDIRECT')) throw err
      setError('auth')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="fd-pw-email">Email</label>
        <input id="fd-pw-email" type="email" className="form-input fd-input" required autoComplete="email"
          value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="form-group">
        <label htmlFor="fd-pw-new">Password</label>
        <div className="input-reveal">
          <input id="fd-pw-new" type={shown ? 'text' : 'password'} className="form-input fd-input" required
            autoComplete="new-password" value={password}
            onChange={e => { setPassword(e.target.value); setTouched(true) }} />
          <EyeToggle shown={shown} onToggle={() => setShown(v => !v)} />
        </div>
        {touched && (
          <ul className="password-rules">
            {PASSWORD_RULES.map(r => (
              <li key={r.key} className={`password-rule ${r.test(password) ? 'password-rule--pass' : 'password-rule--fail'}`}>
                <span className="password-rule__icon">{r.test(password) ? '✓' : '✗'}</span>
                {r.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div aria-live="polite">{error && <div className="auth-error">{authErrorMessage(error)}</div>}</div>
      <button type="submit" className="btn btn--secondary fd-btn-full" disabled={busy}>
        {busy ? 'Creating account…' : 'Create account with password'}
      </button>
      <p className="fd-fineprint">We will email you a link to confirm the address before your first sign-in.</p>
    </form>
  )
}

function PasswordLogin({ email, setEmail, next }: PasswordProps) {
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthErrorCode | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const fd = new FormData()
    fd.set('email', email.trim())
    fd.set('password', password)
    try {
      const result = await signInWithPassword(fd)
      if (result.ok) {
        // A full load, not router.push: the nav and every server component
        // need to re-render with the new session cookie.
        window.location.href = next
        return
      }
      setError(result.error)
    } catch {
      setError('auth')
    }
    setBusy(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label htmlFor="fd-pw-email">Email</label>
        <input id="fd-pw-email" type="email" className="form-input fd-input" required autoComplete="email"
          value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="form-group">
        <div className="fd-label-row">
          <label htmlFor="fd-pw-current">Password</label>
          <Link href="/forgot-password" className="auth-link fd-small">Forgot password?</Link>
        </div>
        <div className="input-reveal">
          <input id="fd-pw-current" type={shown ? 'text' : 'password'} className="form-input fd-input" required
            autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
          <EyeToggle shown={shown} onToggle={() => setShown(v => !v)} />
        </div>
      </div>
      <div aria-live="polite">{error && <div className="auth-error">{authErrorMessage(error)}</div>}</div>
      <button type="submit" className="btn btn--secondary fd-btn-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in with password'}
      </button>
    </form>
  )
}
