'use client'

import Link from 'next/link'
import { useFreePicksSignup } from './useFreePicksSignup'

/**
 * The free-picks sign-up as a right-rail module on the front page. Same hook
 * and the same endpoint as HomeFreePicks, so it lands people on the same list.
 */
export default function HomeFreeBox() {
  const { state, error, email, setEmail, submit } = useFreePicksSignup('home_front_rail')

  return (
    <section className="front-card" aria-labelledby="front-free-title">
      <header className="front-hd"><h2 id="front-free-title">Free picks by email</h2></header>
      <div className="front-free">
        {state === 'sent' ? (
          <p role="status">Check <strong>{email}</strong> for a sign-in link. Click it and you&rsquo;re on the list.</p>
        ) : (
          <>
            <p>Every free play, the moment it drops. No card, unsubscribe in one click.</p>
            <form className="front-free__form" onSubmit={submit}>
              <label htmlFor="front-free-email" className="sr-only">Email address</label>
              <input
                id="front-free-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <button type="submit" className="front-btn front-btn--primary" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Send'}
              </button>
            </form>
            <p className="front-free__legal">
              By continuing you agree to the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
            </p>
          </>
        )}
        {error && <p className="front-free__error" role="alert">{error}</p>}
      </div>
    </section>
  )
}
