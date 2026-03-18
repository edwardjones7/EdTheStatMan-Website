import type { Metadata } from 'next'
import SignupForm from '@/components/SignupForm'

export const metadata: Metadata = {
  title: 'Sign Up – EdTheStatMan.com',
  description: 'Create your EdTheStatMan account.',
  robots: { index: false, follow: false },
}

export default function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="nav__logo-icon" style={{ margin: '0 auto 16px', width: '48px', height: '48px', fontSize: '1.4rem' }}>E</div>
          <h1 className="auth-card__title">Create account</h1>
          <p className="auth-card__subtitle">Join EdTheStatMan and start winning</p>
        </div>

        {searchParams.error && (
          <div className="auth-error">
            {searchParams.error === 'auth' ? 'Something went wrong. Please try again.' : searchParams.error}
          </div>
        )}

        <SignupForm />

        <p className="auth-card__footer">
          Already have an account?{' '}
          <a href="/login" className="auth-link">Sign in</a>
        </p>
      </div>
    </main>
  )
}
