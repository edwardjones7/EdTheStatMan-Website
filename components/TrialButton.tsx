'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { TRIAL_DAYS } from '@/lib/offer'

/**
 * "Try the Research Desk free for 7 days." No card is taken and nothing is
 * charged when it ends, and the copy must never suggest otherwise.
 *
 * Logged out: to signup, and back to the plans after. Logged in but not
 * eligible (already trialled): renders nothing.
 */
export default function TrialButton({
  available,
  loggedIn,
  primary = false,
}: {
  available: boolean
  loggedIn: boolean
  /** The lead action on the card (brand blue) rather than the secondary one. */
  primary?: boolean
}) {
  const btnClass = `btn ${primary ? 'btn--primary' : 'btn--secondary'}`
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const label = `Start ${TRIAL_DAYS}-day free trial`
  const fine = 'No card needed. Nothing to cancel.'

  if (!loggedIn) {
    return (
      <div className="trial-cta">
        <Link
          href={`/signup?next=${encodeURIComponent('/win?trial=1#plan-desk')}`}
          className={btnClass}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {label}
        </Link>
        <p className="trial-cta__fine">{fine}</p>
      </div>
    )
  }
  if (!available) return null

  async function start() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/trial', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.redirect) {
        router.push(data.redirect)
        router.refresh()
        return
      }
      setError(data.error ?? 'Could not start the trial. Please try again.')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    }
    setLoading(false)
  }

  return (
    <div className="trial-cta">
      <button
        type="button"
        className={btnClass}
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={start}
        disabled={loading}
      >
        {loading ? 'Starting your trial…' : label}
      </button>
      <p className="trial-cta__fine">{error ?? fine}</p>
    </div>
  )
}
