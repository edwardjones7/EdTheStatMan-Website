'use client'

import { useLive } from './LiveProvider'
import { scoreText, spreadText, stateText } from './format'

/** The "when" line under a Desk table row: kickoff, then the live score. */
export function LiveWhen({ gameId, fallback }: { gameId: string; fallback: string }) {
  const g = useLive().byId.get(gameId)
  if (!g || g.state === 'pre') return <small>{fallback}</small>
  return (
    <small className="front-pick__live">
      {g.state === 'in' && <i className="front-live__dot" aria-hidden />}
      {scoreText(g)} · {stateText(g)}
    </small>
  )
}

/** A Desk table line cell that swaps to ESPN's number when it has moved. */
export function LiveLine({ gameId, kind, fallback }: { gameId: string; kind: 'spread' | 'total'; fallback: string }) {
  const g = useLive().byId.get(gameId)
  const moved = g && (kind === 'spread' ? g.spreadJustMoved : g.totalJustMoved)
  if (!g || !moved) return <>{fallback}</>
  const now = kind === 'spread' ? spreadText(g.spread, g) : g.total != null ? String(g.total) : null
  if (!now) return <>{fallback}</>
  return <span className="front-moved" title={`Was ${fallback} at the last Desk sync`}>{now}</span>
}

/** "Just moved" marker for the Line movers card. */
export function JustMoved({ gameId }: { gameId: string }) {
  const g = useLive().byId.get(gameId)
  if (!g || !(g.spreadJustMoved || g.totalJustMoved)) return null
  return <span className="front-just">just moved</span>
}
