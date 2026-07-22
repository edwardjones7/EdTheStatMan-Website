'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  priceId: string
  label: string
  variant: 'primary' | 'outline'
  className?: string
  /** Carried through signup so buy-intent survives account creation. */
  tierKey?: 'basic' | 'premium'
}

export default function CheckoutButton({ priceId, label, variant, className, tierKey }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
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
