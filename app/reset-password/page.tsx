import type { Metadata } from 'next'
import { resetPassword } from '@/app/actions/auth'

export const metadata: Metadata = {
  title: 'Reset Password – EdTheStatMan.com',
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
          <div className="nav__logo-icon" style={{ margin: '0 auto 16px', width: '48px', height: '48px', fontSize: '1.4rem' }}>E</div>
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
