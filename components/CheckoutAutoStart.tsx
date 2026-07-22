'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  priceId: string
  planName: string
}

/**
 * Resumes an interrupted purchase. A logged-out visitor who clicks Buy is sent
 * to signup with ?next=/win?checkout=<tier>; on return this fires the checkout
 * they originally asked for so they don't have to find the button again.
 */
export default function CheckoutAutoStart({ priceId, planName }: Props) {
  const started = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    // Set synchronously: React StrictMode double-invokes effects in dev, and a
    // second pass here would open a duplicate Stripe session.
    if (started.current) return
    started.current = true

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priceId }),
        })
        const data = await res.json()
        if (cancelled) return
        if (res.ok && data.url) {
          window.location.href = data.url
          return
        }
        // 401 means the session cookie isn't readable yet — fall through to the
        // page rather than bouncing back to signup and looping.
        setFailed(true)
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()

    return () => { cancelled = true }
  }, [priceId])

  if (failed) return null

  return (
    <div className="checkout-resume" role="status" aria-live="polite">
      <div className="checkout-resume__card">
        <span className="pulse-dot" />
        <span>Taking you to secure checkout for {planName}…</span>
      </div>
    </div>
  )
}
