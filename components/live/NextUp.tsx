'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LIVE_SPORT_LABEL } from '@/lib/live/types'
import { useLive } from './LiveProvider'
import { countdown, spreadText } from './format'

/**
 * "Next up" bar: how many games are live right now and a countdown to the
 * next kickoff or tip, with its line. Renders nothing until the clock and the
 * feed are both on the client, so server and browser HTML never disagree.
 */
export default function NextUp() {
  const { games, ready } = useLive()
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!ready || now == null) return null

  const live = games.filter(g => g.state === 'in')
  const next = games
    .filter(g => g.state === 'pre' && g.kickoff && new Date(g.kickoff).getTime() > now - 60_000)
    .sort((a, b) => new Date(a.kickoff!).getTime() - new Date(b.kickoff!).getTime())[0]

  if (live.length === 0 && !next) return null

  const line = next ? [spreadText(next.spread, next), next.total != null ? `O/U ${next.total}` : null].filter(Boolean).join(' · ') : ''
  const nextBody = next && (
    <>
      <span className="front-next__k">Next up</span>
      <b>{LIVE_SPORT_LABEL[next.sport]} · {next.away.abbrev} at {next.home.abbrev}</b>
      <span className="front-next__cd">{countdown(new Date(next.kickoff!).getTime() - now)}</span>
      {line && <span className="front-next__ln">{line}</span>}
      {next.broadcast && <span className="front-dim">{next.broadcast}</span>}
    </>
  )

  return (
    <div className="front-next" aria-live="off">
      {live.length > 0 && (
        <span className="front-next__live">
          <i className="front-live__dot" aria-hidden />
          {live.length} {live.length === 1 ? 'game' : 'games'} live
        </span>
      )}
      {next && (next.href
        ? <Link href={next.href} className="front-next__game">{nextBody}</Link>
        : <span className="front-next__game">{nextBody}</span>)}
    </div>
  )
}
