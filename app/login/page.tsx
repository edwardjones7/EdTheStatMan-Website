import type { Metadata } from 'next'
import LoginForm from '@/components/LoginForm'

export const metadata: Metadata = {
  title: 'Login – EdTheStatMan.com',
  description: 'Sign in to your EdTheStatMan account.',
  robots: { index: false, follow: false },
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string }
}) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="nav__logo-icon" style={{ margin: '0 auto 16px', width: '48px', height: '48px' }}><svg viewBox="0 0 32 32" width="100%" height="100%"><defs><linearGradient id="login-logo-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs><rect width="32" height="32" rx="4" fill="#0f172a"/><path d="M7 5 L25 5 L23 9 L11 9 L11 14 L22 14 L20.5 18 L11 18 L11 23 L25 23 L23 27 L7 27 Z" fill="url(#login-logo-g)"/></svg></div>
          <h1 className="auth-card__title">Welcome back</h1>
          <p className="auth-card__subtitle">Sign in to your EdTheStatMan account</p>
        </div>

        {searchParams.error === 'auth' && (
          <div className="auth-error">Authentication failed. Please try again.</div>
        )}
        {searchParams.message && (
          <div className="auth-success">{searchParams.message}</div>
        )}

        <LoginForm />

        <p className="auth-card__footer">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="auth-link">Sign up</a>
        </p>
      </div>
    </main>
  )
}
