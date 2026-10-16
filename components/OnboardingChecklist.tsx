'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { atLeastTier } from '@/lib/access'
import '@/styles/lifecycle.css'

/**
 * Four steps that make a new membership actually reach the member: where picks
 * arrive, and the page they paid for.
 *
 * Every tick reflects REAL state, never a "seen it" flag: notify_email off the
 * profile (live, so the toggle below flips it), a push subscription in the
 * database OR on this browser, the Discord link, and a recorded page view of a
 * product page. A checklist that ticks itself because you clicked it would be
 * one more thing on the account page that says something untrue.
 */
interface Props {
  tier: string
  emailOn: boolean
  onEnableEmail: () => void
  emailBusy: boolean
  pushSubscribed: boolean
  discordLinked: boolean
  productVisited: boolean
  /** True straight after checkout (?success=1): show even when all done. */
  justPurchased: boolean
}

/** The page this rung is mostly for. Highest rung first. */
function productPage(tier: string): { href: string; label: string } {
  if (atLeastTier(tier, 'private')) return { href: '/vault', label: 'Open the Vault' }
  if (atLeastTier(tier, 'desk')) return { href: '/desk/nfl', label: 'Open the Research Desk' }
  return { href: '/portfolio', label: 'Open the Portfolio' }
}

export default function OnboardingChecklist({
  tier, emailOn, onEnableEmail, emailBusy, pushSubscribed, discordLinked, productVisited, justPurchased,
}: Props) {
  // The server only knows about subscriptions it has stored; this browser may
  // hold one too (subscribed before this account existed, or a save that is
  // still in flight). Either counts.
  const [pushHere, setPushHere] = useState(false)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => { if (sub) setPushHere(true) })
      .catch(() => {})
  }, [])

  const product = productPage(tier)
  const pushOn = pushSubscribed || pushHere

  const steps = [
    {
      key: 'email',
      done: emailOn,
      title: 'Turn on email alerts',
      hint: 'An email the moment a pick your membership can open is posted.',
      action: emailOn ? null : (
        <button type="button" className="btn btn--outline btn--sm" onClick={onEnableEmail} disabled={emailBusy}>
          Turn on
        </button>
      ),
    },
    {
      key: 'push',
      done: pushOn,
      title: 'Enable browser push',
      hint: 'A notification on this device. Turn it on in Pick Alerts below.',
      action: pushOn ? null : <a href="#alerts" className="btn btn--outline btn--sm">Set up</a>,
    },
    {
      key: 'discord',
      done: discordLinked,
      title: 'Link Discord',
      hint: 'Gets you the Members role for as long as your access is active.',
      action: discordLinked ? null : <a href="/api/discord/connect" className="btn btn--outline btn--sm">Connect</a>,
    },
    {
      key: 'product',
      done: productVisited,
      title: 'Open your first product page',
      hint: 'Everything your membership unlocks starts here.',
      action: productVisited ? null : <Link href={product.href} className="btn btn--outline btn--sm">{product.label}</Link>,
    },
  ]

  const doneCount = steps.filter((s) => s.done).length
  if (doneCount === steps.length && !justPurchased) return null

  return (
    <section className="account-card onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding__head">
        <h2 id="onboarding-title" className="account-card__title">Get set up</h2>
        <span className="onboarding__count">{doneCount} of {steps.length} done</span>
      </div>
      <ul className="onboarding__list">
        {steps.map((s) => (
          <li key={s.key} className={`onboarding__row${s.done ? ' onboarding__row--done' : ''}`}>
            <span className="onboarding__box" aria-hidden="true">{s.done ? '✓' : ''}</span>
            <span className="onboarding__text">
              <span className="onboarding__title">
                {s.title}
                <span className="sr-only">{s.done ? ' (done)' : ' (not done yet)'}</span>
              </span>
              <span className="onboarding__hint">{s.hint}</span>
            </span>
            {s.action && <span className="onboarding__action">{s.action}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
