import type { Metadata } from 'next'
import AuthPanel from '@/components/AuthPanel'
import { IconCheckCircle } from '@/components/Icons'
import { safeNext } from '@/lib/safe-redirect'
import { authErrorMessage } from '@/lib/auth-errors'
import { TRIAL_DAYS } from '@/lib/offer'
import '@/styles/front-door.css'

export const metadata: Metadata = {
  title: 'Create a Free Account – EdTheStatMan.com',
  description: 'Free picks, a free Research Desk trial, and pick alerts. Sign up with Google or one email link.',
  robots: { index: false, follow: false },
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string; email?: string }
}) {
  const next = safeNext(searchParams.next, '/')

  // Every line must be true for a free account today -- checked against
  // OFFER_FREE_FEATURES in lib/offer.ts and against lib/notify/audience.ts,
  // which alerts confirmed free accounts to free picks. Google and magic-link
  // accounts are confirmed by the sign-in itself, so the alert line holds for
  // both of the main paths.
  const perks = [
    { title: 'Free picks', text: 'Every free-tagged model pick, with its result.' },
    {
      title: `A ${TRIAL_DAYS}-day Research Desk trial`,
      text: 'The whole Desk and Vault, free. No card, and it ends on its own.',
    },
    { title: 'Pick alerts', text: 'An email or a push notification the moment a free pick drops.' },
    { title: 'The public record', text: 'Records and win rates on every locked row, so you can judge before you pay.' },
  ]

  return (
    <main className="auth-page fd-page">
      <div className="fd-layout">
        <section className="fd-value" aria-labelledby="fd-value-title">
          <span className="section-label">Free account</span>
          <h1 id="fd-value-title" className="fd-value__title">
            Start free. <span className="text-gradient">No card, no password.</span>
          </h1>
          <ul className="fd-perks">
            {perks.map(p => (
              <li key={p.title} className="fd-perk">
                <span className="fd-perk__icon" aria-hidden="true"><IconCheckCircle size={18} /></span>
                <span>
                  <strong className="fd-perk__title">{p.title}</strong>
                  <span className="fd-perk__text">{p.text}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="fd-value__note">Paid plans are optional and you can look at them any time. A free account never turns into one by itself.</p>
        </section>

        <div className="auth-card fd-card">
          <div className="auth-card__header fd-card__header">
            <h2 className="auth-card__title">Create your free account</h2>
            <p className="auth-card__subtitle">Takes about ten seconds</p>
          </div>

          {searchParams.error && (
            <div className="auth-error">{authErrorMessage(searchParams.error)}</div>
          )}

          <AuthPanel mode="signup" next={next} initialEmail={searchParams.email ?? ''} />

          <p className="auth-card__footer">
            Already have an account?{' '}
            <a href={`/login?next=${encodeURIComponent(next)}`} className="auth-link">Sign in</a>
          </p>
          <p className="fd-legal">
            By continuing you agree to the <a href="/terms" className="auth-link">Terms</a> and{' '}
            <a href="/privacy" className="auth-link">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </main>
  )
}
