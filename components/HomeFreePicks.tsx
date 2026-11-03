'use client'

import { useState } from 'react'
import { sendMagicLink } from '@/app/actions/auth'
import { authErrorMessage } from '@/lib/auth-errors'
import { trackEvent } from '@/lib/track-client'
import { IconChat } from './Icons'

const DISCORD = 'https://discord.gg/rXBZkSPcJb'

/**
 * The free offer for a visitor who is not ready to start a trial: the free
 * picks by email, or Discord.
 *
 * There is no separate mailing list. A free account IS the email list: every
 * free pick already notifies every confirmed account that has not opted out
 * (lib/notify/audience.ts), and every one of those emails carries a one-click
 * unsubscribe. So this box is the magic-link signup with one field. The link
 * both confirms the address and signs them in, which matters because the
 * notifier never mails an unconfirmed address (the September signup bot).
 *
 * sendMagicLink is BotID-checked and the homepage is listed in
 * lib/botid-routes.ts for exactly that reason; without the listing every
 * visitor here would classify as a bot.
 *
 * Logged-out visitors only; the page decides that.
 */
export default function HomeFreePicks() {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('sending')
    setError(null)
    trackEvent('signup_start', { method: 'magic_link', from: 'home_free_picks' })
    const fd = new FormData()
    fd.set('email', email)
    fd.set('next', '/portfolio')
    try {
      const result = await sendMagicLink(fd)
      if (result.ok) {
        trackEvent('magic_link_sent', { from: 'home_free_picks' })
        setState('sent')
      } else {
        setError(authErrorMessage(result.error))
        setState('idle')
      }
    } catch {
      setError(authErrorMessage('auth'))
      setState('idle')
    }
  }

  return (
    <section className="home-free" aria-labelledby="home-free-title">
      <div className="container home-free__inner">
        <h2 id="home-free-title" className="home-free__title">Not ready for the Desk? Take the free picks.</h2>
        <p className="home-free__sub">
          Every free play Ed posts, in your inbox the moment it drops. Free, no card, unsubscribe in one click.
        </p>

        {state === 'sent' ? (
          <p className="home-free__sent" role="status">
            Check <strong>{email}</strong> for a sign-in link. Click it and you&rsquo;re on the list.
          </p>
        ) : (
          <form className="home-free__form" onSubmit={submit}>
            <label htmlFor="home-free-email" className="sr-only">Email address</label>
            <input
              id="home-free-email"
              type="email"
              name="email"
              required
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="home-free__input"
            />
            <button type="submit" className="home-btn home-btn--primary" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Send me free picks'}
            </button>
          </form>
        )}
        {error && <p className="home-free__error" role="alert">{error}</p>}

        <p className="home-free__alt">
          Or{' '}
          <a
            href={DISCORD}
            target="_blank"
            rel="noopener"
            className="home-free__discord"
            onClick={() => trackEvent('discord_connect', { from: 'home_free_picks' })}
          >
            <IconChat size={14} /> join the free Discord
          </a>
          {' '}for picks and system updates as they post.
        </p>
      </div>
    </section>
  )
}
