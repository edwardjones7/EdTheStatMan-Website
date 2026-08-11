'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { captureFirstTouch, getFirstTouch, STAMPED_KEY } from '@/lib/attribution'

export default function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    if (pathname === lastTracked.current) return
    if (pathname.startsWith('/admin')) return
    lastTracked.current = pathname

    captureFirstTouch()

    // Attach first-touch attribution until the server confirms it stamped the
    // logged-in profile (or reports it was already stamped).
    let firstTouch = null
    try {
      if (!localStorage.getItem(STAMPED_KEY)) firstTouch = getFirstTouch()
    } catch {}

    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        utm: {
          source: searchParams.get('utm_source'),
          medium: searchParams.get('utm_medium'),
          campaign: searchParams.get('utm_campaign'),
        },
        ...(firstTouch ? { firstTouch } : {}),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data?.stamped) {
          try { localStorage.setItem(STAMPED_KEY, '1') } catch {}
        }
      })
      .catch(() => {})
  }, [pathname, searchParams])

  return null
}
