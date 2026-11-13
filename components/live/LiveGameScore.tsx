'use client'

import { useLive } from './LiveProvider'

interface Props {
  gameId: string
  awayAbbrev: string
  homeAbbrev: string
  /** What the server rendered from the stored row; shown until the feed says otherwise. */
  awayScore: number | null
  homeScore: number | null
  status: string
}

/**
 * The score line in a Desk game page header, kept live from /api/live: score,
 * clock, possession and down-and-distance while it is played, the final after.
 */
export default function LiveGameScore(p: Props) {
  const g = useLive().byId.get(p.gameId)
  const state = g?.state ?? p.status
  const away = g && g.state !== 'pre' ? g.away.score : p.awayScore
  const home = g && g.state !== 'pre' ? g.home.score : p.homeScore
  if (state === 'pre' || away == null || home == null) return null
  const live = state === 'in'

  return (
    <div className={`nfl-game-header__score${live ? ' is-live' : ''}`}>
      {live && (
        <span className="nfl-game-header__live">
          <i className="front-live__dot" aria-hidden />
          {g?.detail || 'Live'}
        </span>
      )}
      <span>{g?.possession === 'away' && <i className="desk-card__poss" aria-label="has the ball" />}{p.awayAbbrev} {away}</span>
      <span className="nfl-game-header__score-sep">—</span>
      <span>{p.homeAbbrev} {home}{g?.possession === 'home' && <i className="desk-card__poss" aria-label="has the ball" />}</span>
      {live && g?.downDistance && <span className="nfl-game-header__dd">{g.downDistance}{g.redZone ? ' · red zone' : ''}</span>}
    </div>
  )
}
