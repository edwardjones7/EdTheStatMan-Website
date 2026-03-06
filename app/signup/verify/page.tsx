import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Verify Your Email – EdTheStatMan.com',
}

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string }
}) {
  const email = searchParams.email

  return (
    <main className="auth-page">
      <div className="auth-card verify-card">
        <div className="verify-icon">&#9993;</div>

        <h1 className="auth-card__title" style={{ marginBottom: '12px' }}>Check your email</h1>

        <p className="verify-desc">
          We sent a verification link to{' '}
          {email
            ? <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
            : 'your email address'
          }.
        </p>

        <p className="verify-desc">
          Click the link in the email to confirm your account and get started.
        </p>

        <div className="verify-steps">
          <div className="verify-step">
            <span className="verify-step__num">1</span>
            <span>Open your email inbox</span>
          </div>
          <div className="verify-step">
            <span className="verify-step__num">2</span>
            <span>Find the email from EdTheStatMan</span>
          </div>
          <div className="verify-step">
            <span className="verify-step__num">3</span>
            <span>Click <strong style={{ color: 'var(--text-primary)' }}>Confirm your account</strong></span>
          </div>
        </div>

        <p className="verify-hint">
          Didn&apos;t receive it? Check your spam folder, or{' '}
          <Link href="/signup" className="auth-link">try signing up again</Link>.
        </p>

        <Link href="/login" className="btn btn--outline" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
          Back to Sign In
        </Link>
      </div>
    </main>
  )
}
