'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getFirstTouch } from '@/lib/attribution'
import type { OfferTierKey, BillingPeriod } from '@/lib/offer'

interface Props {
  priceId: string
  label: string
  variant: 'primary' | 'outline'
  className?: string
  /** Carried through signup so buy-intent survives account creation. */
  tierKey?: OfferTierKey
  /** Carried through signup with tierKey, so a monthly buyer resumes on monthly. */
  period?: BillingPeriod
}

export default function CheckoutButton({ priceId, label, variant, className, tierKey, period }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    setError(null)
    // Funnel event, fire-and-forget — must never block checkout.
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: window.location.pathname,
        event: 'checkout_click',
        meta: tierKey ? { tier: tierKey } : null,
      }),
    }).catch(() => {})
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, attribution: getFirstTouch() }),
      })
      const data = await res.json()
      if (res.status === 401) {
        // Send them to signup (a logged-out buyer usually has no account) and
        // carry the chosen plan so checkout resumes automatically afterwards.
        const dest = tierKey
          ? `/win?checkout=${tierKey}${period ? `&period=${period}` : ''}`
          : '/win'
        router.push(`/signup?next=${encodeURIComponent(dest)}`)
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else if (data.redirect) {
        // A plan switch on a live subscription is done in place, server side
        // (app/api/stripe/checkout): the card has already been charged and
        // there is no Stripe page to visit. Treating this as an error told
        // members a successful upgrade had failed.
        router.push(data.redirect)
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.')
        setLoading(false)
      }
    } catch {
      setError('Could not reach checkout. Check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <>
    <button
      className={`btn btn--${variant}${className ? ` ${className}` : ''}`}
      style={{ width: '100%', justifyContent: 'center' }}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? 'Redirecting to checkout…' : label}
    </button>
    {error && <p className="checkout-error" role="alert">{error}</p>}
    </>
  )
}
