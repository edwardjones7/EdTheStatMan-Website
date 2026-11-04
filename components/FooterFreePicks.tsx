'use client'

import Link from 'next/link'
import { useFreePicksSignup } from './useFreePicksSignup'

/** The free-picks opt-in on every page. Logged-out visitors only; the layout decides that. */
export default function FooterFreePicks() {
  const { state, error, email, setEmail, submit } = useFreePicksSignup('footer')

  return (
    <section className="footer-free" aria-labelledby="footer-free-title">
      <div className="footer-free__copy">
        <h2 id="footer-free-title" className="footer-free__title">Get the free picks by email</h2>
        <p className="footer-free__sub">Every free play, the moment it drops. No card, unsubscribe in one click.</p>
      </div>

      <div className="footer-free__action">
        {state === 'sent' ? (
          <p className="footer-free__sent" role="status">
            Check <strong>{email}</strong> for a sign-in link. Click it and you&rsquo;re on the list.
          </p>
        ) : (
          <form className="footer-free__form" onSubmit={submit}>
            <label htmlFor="footer-free-email" className="sr-only">Email address</label>
            <input
              id="footer-free-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="footer-free__input"
            />
            <button type="submit" className="btn btn--primary" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send me free picks'}
            </button>
          </form>
        )}
        {error && <p className="footer-free__error" role="alert">{error}</p>}
        {state !== 'sent' && (
          <p className="footer-free__legal">
            By continuing you agree to the <Link href="/terms">Terms</Link> and{' '}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
        )}
      </div>
    </section>
  )
}
