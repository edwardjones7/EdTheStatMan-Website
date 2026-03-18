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
          <div className="nav__logo-icon" style={{ margin: '0 auto 16px', width: '48px', height: '48px', fontSize: '1.4rem' }}>E</div>
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
