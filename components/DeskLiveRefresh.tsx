'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  sport: string
  /**
   * Whether this week has anything worth watching: a game in progress, or one
   * about to start. Computed on the server from `status` and kickoff, so the
   * client never has to decide it during render and disagree with the HTML it
   * is hydrating.
   */
  live: boolean
}

/** While something is in progress. Scores and clock move on this scale. */
const LIVE_INTERVAL_MS = 60_000

/**
 * Keeps the board it is mounted on current, for as long as it is being looked
 * at.
 *
 * The server already orders the board by `status` -- live games lead their day,
 * finished days sink -- so refreshing the data is all that is needed for the
 * page to reorder itself. Nothing here knows about games; it asks for a sync
 * and then asks the router for a new render.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *
 *   - Poll when nothing is live. A schedule three days out does not change on a
 *     one-minute scale, and every tick is a function invocation. One catch-up
 *     call on arrival, then it stops.
 *   - Poll a tab nobody is looking at. Browsers throttle background timers to
 *     roughly one a minute anyway, so the requests that do get through are the
 *     least useful ones on the site. It stands down on hide and does one
 *     immediate refresh on show, which is the moment a stale board is actually
 *     seen.
 */
export default function DeskLiveRefresh({ sport, live }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  // Ref rather than state: the interval closes over this, and re-creating the
  // interval on every render to see a new value would reset the clock.
  const running = useRef(false)

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      if (running.current || document.visibilityState === 'hidden') return
      running.current = true
      setBusy(true)
      try {
        const res = await fetch(`/api/desk/refresh?sport=${encodeURIComponent(sport)}`, {
          method: 'POST',
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        // Only re-render when something actually changed. A 'fresh' answer is
        // the common case on a busy board and re-rendering on it would throw a
        // server round trip away every minute for nothing.
        if (!cancelled && data?.synced) router.refresh()
      } catch {
        // A failed sync is not worth telling the reader about: the board is
        // still showing real data, just not newer data.
      } finally {
        running.current = false
        if (!cancelled) setBusy(false)
      }
    }

    // Arriving on the board is itself a reason to catch up, live or not: this is
    // the first moment anyone has asked for this week since the last visitor.
    refresh()

    // Registered whether or not anything is live, because a board opened in a
    // BACKGROUND tab -- middle-click, "open in new tab", a restored session --
    // mounts hidden, so the catch-up call above returns without doing anything.
    // Gating this listener on `live` too meant that board then sat stale
    // forever, and the first time it was actually looked at was the one moment
    // it had no way to notice.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)

    // The repeating poll is the only part that depends on something happening.
    const id = live ? setInterval(refresh, LIVE_INTERVAL_MS) : null

    return () => {
      cancelled = true
      if (id) clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [sport, live, router])

  if (!live) return null

  return (
    <div className="desk-live" aria-live="polite">
      <span className={`desk-live__dot${busy ? ' desk-live__dot--busy' : ''}`} aria-hidden />
      <span>{busy ? 'Updating…' : 'Live — updating automatically'}</span>
    </div>
  )
}
