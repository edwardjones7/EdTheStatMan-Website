'use client'

import Link from 'next/link'
import type { BriefPick } from '@/lib/brief'
import type { LiveGame, PickTrack } from '@/lib/live/types'
import { pickStatus } from '@/lib/live/cover'
import { useLive } from './LiveProvider'
import { minus, scoreText, stateText } from './format'

interface Props {
  picks: BriefPick[]
  tracks: PickTrack[]
  lockedGameIds: string[]
  lockedCount: number
  lockedSports: string
  dateNote: string | null
}

function GameLine({ g }: { g: LiveGame }) {
  return (
    <small className="front-pick__live">
      {g.state === 'in' && <i className="front-live__dot" aria-hidden />}
      {g.state === 'pre' ? stateText(g) : `${scoreText(g)} · ${stateText(g)}`}
    </small>
  )
}

/**
 * Tonight's card with the sweat attached: each visible pick shows its game's
 * live score and whether it is covering. A final shows what the score implies,
 * marked unofficial until Ed grades it. Locked picks show only that Ed has a
 * play on a game, with that game's score; never the side or the number.
 */
export default function LivePicks({ picks, tracks, lockedGameIds, lockedCount, lockedSports, dateNote }: Props) {
  const { byId } = useLive()
  const trackOf = new Map(tracks.map(t => [t.pickId, t]))

  let w = 0, l = 0, p = 0
  const rows = picks.map(pick => {
    const track = trackOf.get(pick.id)
    const game = track ? byId.get(track.gameId) : pick.gameId ? byId.get(pick.gameId) : undefined
    const status = track && game ? pickStatus(track, game) : null
    if (!pick.result && status?.final) {
      if (status.final === 'win') w++
      else if (status.final === 'loss') l++
      else p++
    }
    return { pick, game, status }
  })
  const unofficial = w + l + p > 0 ? `${w}-${l}${p ? `-${p}` : ''} so far, unofficial` : null
  const lockedGames = lockedGameIds.map(id => byId.get(id)).filter(Boolean) as LiveGame[]

  return (
    <ul className="front-list">
      {dateNote && <li className="front-list__note">{dateNote}</li>}
      {unofficial && <li className="front-list__note front-live-tally">{unofficial}</li>}
      {rows.map(({ pick, game, status }) => (
        <li key={pick.id} className={status?.final && !pick.result ? `is-final is-final--${status.final}` : undefined}>
          <span className="front-tag">{pick.sport}</span>
          <span className="front-pick">
            <b title={pick.bet}>{pick.bet}</b>
            {game ? <GameLine g={game} /> : pick.line && <small>{minus(pick.line)}</small>}
            {!pick.result && status && status.tone !== 'none' && (
              <small
                className={`front-stat front-stat--${status.tone}`}
                title={status.final ? 'What the final score implies. Official once Ed grades it.' : undefined}
              >
                {status.final === 'win' ? '✓ ' : status.final === 'loss' ? '✗ ' : ''}
                {status.text}
                {status.final && <em> · unofficial</em>}
              </small>
            )}
          </span>
          {pick.result && (
            <span className={`front-res front-res--${pick.result.toLowerCase()}`}>{pick.result}</span>
          )}
        </li>
      ))}
      {lockedCount > 0 && (
        <li className="front-locked">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span className="front-pick">
            <b>{lockedCount} members&rsquo; {lockedCount === 1 ? 'play' : 'plays'}{lockedGames.length > 0 ? ' on' : ''}</b>
            {lockedGames.length > 0
              ? lockedGames.map(g => (
                  <small key={g.espnId} className="front-pick__live">
                    {g.state === 'in' && <i className="front-live__dot" aria-hidden />}
                    {g.state === 'pre' ? `${g.away.abbrev} at ${g.home.abbrev}, ${stateText(g)}` : `${scoreText(g)} · ${stateText(g)}`}
                  </small>
                ))
              : <small>{lockedSports}</small>}
          </span>
          <Link href="/portfolio" className="front-unlock">Unlock</Link>
        </li>
      )}
    </ul>
  )
}
