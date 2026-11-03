import type { Metadata } from 'next'
import { forgotPassword } from '@/app/actions/auth'
import { authErrorMessage } from '@/lib/auth-errors'
import BrandMark from '@/components/BrandMark'

export const metadata: Metadata = {
  title: 'Forgot Password – EdTheStatMan.com',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; sent?: string }
}) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="auth-card__mark"><BrandMark size={48} variant="tile" title="EdTheStatMan" /></div>
          <h1 className="auth-card__title">Reset password</h1>
          <p className="auth-card__subtitle">Enter your email and we'll send you a reset link</p>
        </div>

        {/* Codes only; the page used to print Supabase's text, or anything a
            crafted link put in ?error=. */}
        {searchParams.error && (
          <div className="auth-error">{authErrorMessage(searchParams.error)}</div>
        )}

        {searchParams.sent ? (
          <div className="auth-success" style={{ textAlign: 'center', padding: '16px 0' }}>
            Check your email for a password reset link.
          </div>
        ) : (
          <form action={forgotPassword} className="auth-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-input"
                placeholder="your@email.com"
                required
                autoComplete="email"
              />
            </div>
            <button type="submit" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
              Send Reset Link
            </button>
          </form>
        )}

        <p className="auth-card__footer">
          Rather skip the password?{' '}
          <a href="/login" className="auth-link">Get a sign-in link instead</a>
        </p>
      </div>
    </main>
  )
}
