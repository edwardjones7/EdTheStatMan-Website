'use client'

import { useState } from 'react'

export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
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
    <button className="btn btn--outline btn--sm" onClick={handleClick} disabled={loading}>
      {loading ? 'Loading…' : 'Manage Billing'}
    </button>
  )
}
