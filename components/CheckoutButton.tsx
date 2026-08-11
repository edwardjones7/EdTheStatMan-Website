'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getFirstTouch } from '@/lib/attribution'
import type { OfferTierKey } from '@/lib/offer'

interface Props {
  priceId: string
  label: string
  variant: 'primary' | 'outline'
  className?: string
  /** Carried through signup so buy-intent survives account creation. */
  tierKey?: OfferTierKey
}

export default function CheckoutButton({ priceId, label, variant, className, tierKey }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
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
        const dest = tierKey ? `/win?checkout=${tierKey}` : '/win'
        router.push(`/signup?next=${encodeURIComponent(dest)}`)
        return
      }
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error ?? 'Something went wrong.')
        setLoading(false)
      }
    } catch {
      alert('Something went wrong.')
      setLoading(false)
    }
  }

  return (
    <button
      className={`btn btn--${variant}${className ? ` ${className}` : ''}`}
      style={{ width: '100%', justifyContent: 'center' }}
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? 'Redirecting to checkout…' : label}
    </button>
  )
}
