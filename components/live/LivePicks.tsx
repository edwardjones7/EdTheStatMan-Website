'use client'

import Link from 'next/link'
import type { BriefPick } from '@/lib/brief'
import type { LiveGame, PickTrack } from '@/lib/live/types'
import { pickStatus } from '@/lib/live/cover'
import { useLive } from './LiveProvider'
import TeamLogo, { hasTeamLogo } from '../TeamLogo'
import { SignupLink } from '../SignupPrompt'
import { TRIAL_DAYS } from '@/lib/offer'
import { minus, scoreText, stateText } from './format'

interface Props {
  picks: BriefPick[]
  tracks: PickTrack[]
  lockedGameIds: string[]
  lockedCount: number
  lockedSports: string
  dateNote: string | null
  /** Signed-out visitors get a free-trial ask on the lock instead of "Unlock". */
  signedOut?: boolean
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
export default function LivePicks({ picks, tracks, lockedGameIds, lockedCount, lockedSports, dateNote, signedOut = false }: Props) {
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
    // The team Ed is on, when the pick names a side and the game is in the feed.
    const team = track?.side && game ? game[track.side].abbrev : null
    return { pick, game, status, team }
  })
  const unofficial = w + l + p > 0 ? `${w}-${l}${p ? `-${p}` : ''} so far, unofficial` : null
  const lockedGames = lockedGameIds.map(id => byId.get(id)).filter(Boolean) as LiveGame[]
  const lockedLive = lockedGames.filter(g => g.state === 'in')

  return (
    <ul className="front-list">
      {dateNote && <li className="front-list__note">{dateNote}</li>}
      {unofficial && <li className="front-list__note front-live-tally">{unofficial}</li>}
      {rows.map(({ pick, game, status, team }) => (
        <li key={pick.id} className={status?.final && !pick.result ? `is-final is-final--${status.final}` : undefined}>
          {team && hasTeamLogo(pick.sport, team)
            ? <span className="front-pick__logo" title={`${pick.sport} · ${team}`}><TeamLogo sport={pick.sport} abbrev={team} size={22} /></span>
            : <span className={`front-tag front-tag--${pick.sport.toLowerCase()}`}>{pick.sport}</span>}
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
            <span className={`front-res front-res--${pick.result.toLowerCase()}`}>
              {/* Pending while its game is on: a live dot, so the card shows it is in play. */}
              {pick.result.toLowerCase() === 'pending' && game?.state === 'in' && <i className="front-live__dot front-res__dot" aria-label="in play" />}
              {pick.result.toLowerCase() === 'win' ? '✓ ' : pick.result.toLowerCase() === 'loss' ? '✗ ' : ''}{pick.result}
            </span>
          )}
        </li>
      ))}
      {lockedCount > 0 && (
        <li className={`front-locked${signedOut ? ' front-locked--ask' : ''}${lockedLive.length > 0 ? ' is-live' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span className="front-pick">
            <b>
              {lockedLive.length > 0
                ? <>Ed has {lockedLive.length === 1 ? 'a play' : `${lockedLive.length} plays`} live right now</>
                : <>{lockedCount} members&rsquo; {lockedCount === 1 ? 'play' : 'plays'}{lockedGames.length > 0 ? ' on' : ''}</>}
            </b>
            {lockedGames.length > 0
              ? lockedGames.map(g => (
                  <small key={g.espnId} className="front-pick__live">
                    {g.state === 'in' && <i className="front-live__dot" aria-hidden />}
                    {g.state === 'pre' ? `${g.away.abbrev} at ${g.home.abbrev}, ${stateText(g)}` : `${scoreText(g)} · ${stateText(g)}`}
                  </small>
                ))
              : <small>{lockedSports}</small>}
          </span>
          {signedOut
            ? null
            : <Link href="/portfolio" className="front-unlock">Unlock</Link>}
        </li>
      )}
      {lockedCount > 0 && signedOut && (
        // The lock is the strongest reason to sign up, so the ask sits on it.
        // A free account comes with the Desk trial, and the Desk includes the
        // Portfolio picks, so "see them free" is literally true.
        <li className="front-ask">
          <SignupLink context={lockedLive.length > 0 ? 'home_card_live' : 'home_card_locked'} next="/" className="front-ask__btn">
            {lockedLive.length > 0 ? 'See the live side free' : `See ${lockedCount === 1 ? 'it' : 'them'} free`} &rarr;
          </SignupLink>
          <small>{TRIAL_DAYS}-day free trial with a free account. No card.</small>
        </li>
      )}
    </ul>
  )
}
