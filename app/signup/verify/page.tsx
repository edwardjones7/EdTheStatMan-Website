import type { Metadata } from 'next'
import Link from 'next/link'
import { IconMail } from '@/components/Icons'
import { safeNext } from '@/lib/safe-redirect'
import ResendButton from './ResendButton'
import '@/styles/front-door.css'

export const metadata: Metadata = {
  title: 'Verify Your Email – EdTheStatMan.com',
  // Without this it inherited the root layout's canonical and told crawlers
  // it was a copy of the homepage.
  robots: { index: false, follow: false },
}

export default function VerifyEmailPage({
  searchParams,
}: {
  searchParams: { email?: string; next?: string }
}) {
  const email = searchParams.email
  // Carried through so "try again" and "back to sign in" land where the visitor
  // was going, not on the homepage.
  const next = safeNext(searchParams.next, '/')
  const nextQs = `next=${encodeURIComponent(next)}`

  return (
    <main className="auth-page">
      <div className="auth-card verify-card">
        <div className="verify-icon"><IconMail size={28} /></div>

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
          Didn&apos;t receive it? Check your spam folder first.
          {email ? ' Or send a new link below; it confirms the account and signs you in.' : ''}
        </p>

        {email && <ResendButton email={email} next={next} />}

        <p className="verify-hint" style={{ marginTop: '16px' }}>
          Wrong address?{' '}
          <Link href={`/signup?${nextQs}`} className="auth-link">Start again</Link>.
        </p>

        <Link href={`/login?${nextQs}`} className="btn btn--outline" style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}>
          Back to Sign In
        </Link>
      </div>
    </main>
  )
}
