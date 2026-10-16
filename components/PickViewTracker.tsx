'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/track-client'

/**
 * Records that a pick page was opened, and that its lock was seen when the
 * pick is a members' one. A client component because the page itself is
 * cached and served identically to everyone: a server-side count would
 * record the cache fill, not the visitor.
 */
export default function PickViewTracker({ pickId, sport, free, locked }: {
  pickId: string
  sport: string
  free: boolean
  locked: boolean
}) {
  useEffect(() => {
    trackEvent('pick_view', { pick_id: pickId, sport, free })
    if (locked) trackEvent('paywall_view', { pick_id: pickId, sport, surface: 'pick_page' })
  }, [pickId, sport, free, locked])
  return null
}
