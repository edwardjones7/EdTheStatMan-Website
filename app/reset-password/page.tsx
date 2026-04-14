import type { Metadata } from 'next'
import { resetPassword } from '@/app/actions/auth'

export const metadata: Metadata = {
  title: 'Reset Password – EdTheStatMan.com',
  robots: { index: false, follow: false },
}

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="nav__logo-icon" style={{ margin: '0 auto 16px', width: '48px', height: '48px' }}><svg viewBox="0 0 32 32" width="100%" height="100%"><defs><linearGradient id="reset-logo-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs><rect width="32" height="32" rx="4" fill="#0f172a"/><path d="M7 5 L25 5 L23 9 L11 9 L11 14 L22 14 L20.5 18 L11 18 L11 23 L25 23 L23 27 L7 27 Z" fill="url(#reset-logo-g)"/></svg></div>
          <h1 className="auth-card__title">Choose a new password</h1>
          <p className="auth-card__subtitle">Must be at least 8 characters</p>
        </div>

        {searchParams.error && (
          <div className="auth-error">{searchParams.error}</div>
        )}

        <form action={resetPassword} className="auth-form">
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              name="password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
            Update Password
          </button>
        </form>
      </div>
    </main>
  )
}
