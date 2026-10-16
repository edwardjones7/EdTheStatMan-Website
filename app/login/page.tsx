import type { Metadata } from 'next'
import AuthPanel from '@/components/AuthPanel'
import { safeNext } from '@/lib/safe-redirect'
import { authErrorMessage } from '@/lib/auth-errors'
import '@/styles/front-door.css'

export const metadata: Metadata = {
  title: 'Sign In – EdTheStatMan.com',
  description: 'Sign in to your EdTheStatMan account.',
  robots: { index: false, follow: false },
}

const LOGIN_MESSAGES: Record<string, string> = {
  'password-updated': 'Password updated. Sign in with your new password below.',
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string; next?: string }
}) {
  const next = safeNext(searchParams.next, '/')
  // hasOwnProperty, not a bare lookup: ?message=constructor would otherwise
  // hand React a function.
  const m = searchParams.message
  const message = m && Object.prototype.hasOwnProperty.call(LOGIN_MESSAGES, m) ? LOGIN_MESSAGES[m] : null
  return (
    <main className="auth-page fd-page">
      <div className="auth-card fd-card">
        <div className="auth-card__header fd-card__header">
          <div className="nav__logo-icon" style={{ margin: '0 auto 16px', width: '48px', height: '48px' }}><svg viewBox="0 0 32 32" width="100%" height="100%"><defs><linearGradient id="login-logo-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#2dd4bf"/><stop offset="100%" stopColor="#38bdf8"/></linearGradient></defs><rect width="32" height="32" rx="4" fill="#0f172a"/><path d="M7 5 L25 5 L23 9 L11 9 L11 14 L22 14 L20.5 18 L11 18 L11 23 L25 23 L23 27 L7 27 Z" fill="url(#login-logo-g)"/></svg></div>
          <h1 className="auth-card__title">Welcome back</h1>
          <p className="auth-card__subtitle">Sign in with Google or a one-time email link</p>
        </div>

        {/* Codes only: the page used to print whatever ?error= said. */}
        {searchParams.error && (
          <div className="auth-error">{authErrorMessage(searchParams.error)}</div>
        )}
        {/* Known codes only, for the same reason as `error`. resetPassword
            is the one caller. */}
        {message && <div className="auth-success">{message}</div>}

        <AuthPanel mode="login" next={next} />

        <p className="auth-card__footer">
          New here?{' '}
          <a href={`/signup?next=${encodeURIComponent(next)}`} className="auth-link">Create a free account</a>
        </p>
      </div>
    </main>
  )
}
