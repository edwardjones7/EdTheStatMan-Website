import type { Metadata } from 'next'
import AuthPanel from '@/components/AuthPanel'
import { safeNext } from '@/lib/safe-redirect'
import { authErrorMessage } from '@/lib/auth-errors'
import '@/styles/front-door.css'
import BrandMark from '@/components/BrandMark'

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
          <div className="auth-card__mark"><BrandMark size={48} variant="tile" title="EdTheStatMan" /></div>
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
