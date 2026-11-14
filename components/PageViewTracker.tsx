'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { captureFirstTouch, getFirstTouch, STAMPED_KEY } from '@/lib/attribution'
import { canTrack, onFirstHumanSignal, sendTrack } from '@/lib/track-client'

/**
 * One page view per route, counted once a person is evidently there.
 *
 * The first page of a visit is held until the visitor scrolls, moves the
 * pointer, touches or types; after that, every page in the tab counts at once.
 * Crawlers that run JavaScript but never interact are left out, as are local
 * and preview deployments, automated browsers and any browser an admin uses
 * (lib/track-client.ts canTrack).
 */
export default function PageViewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const lastTracked = useRef<string | null>(null)

  useEffect(() => {
    if (pathname === lastTracked.current) return
    if (pathname.startsWith('/admin')) return
    lastTracked.current = pathname

    // Attribution is captured for everyone, counted or not: it decides which
    // channel a later signup is credited to.
    captureFirstTouch()
    if (!canTrack()) return

    // Read now, so a slow first interaction still reports where they came from.
    const referrer = document.referrer || null
    const utm = {
      source: searchParams.get('utm_source'),
      medium: searchParams.get('utm_medium'),
      campaign: searchParams.get('utm_campaign'),
    }

    return onFirstHumanSignal(() => {
      // Attach first-touch attribution until the server confirms it stamped
      // the logged-in profile (or reports it was already stamped).
      let firstTouch = null
      try {
        if (!localStorage.getItem(STAMPED_KEY)) firstTouch = getFirstTouch()
      } catch {}

      void sendTrack({ path: pathname, referrer, utm, ...(firstTouch ? { firstTouch } : {}) })
        .then(data => {
          if (data?.stamped) {
            try { localStorage.setItem(STAMPED_KEY, '1') } catch {}
          }
        })
    })
  }, [pathname, searchParams])

  return null
}
