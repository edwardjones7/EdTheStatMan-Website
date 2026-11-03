'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * The homepage hero's trial button for a signed-in member who may start one.
 * Same POST as TrialButton (components/TrialButton.tsx), set as the hero's
 * primary button. No card is taken and nothing is charged when it ends.
 */
export default function HomeTrialButton({ label }: { label: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

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
    <>
      <button type="button" className="home-btn home-btn--primary" onClick={start} disabled={loading}>
        {loading ? 'Starting your trial…' : label}
      </button>
      {error && <p className="home-hero__error" role="alert">{error}</p>}
    </>
  )
}
