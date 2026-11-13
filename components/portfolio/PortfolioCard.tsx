'use client'

import Link from 'next/link'
import type { CardDay, CardPick, LockedPick, PortfolioGame, VisiblePick } from '@/lib/portfolio'
import type { LiveGame, PickTrack } from '@/lib/live/types'
import { pickStatus, type LiveStatus } from '@/lib/live/cover'
import { teamLogoUrl } from '@/lib/logos'
import { useLive } from '@/components/live/LiveProvider'
import { kickoffText, minus, stateText } from '@/components/live/format'

/**
 * The current card as one tile per pick, with the sweat attached. Everything
 * here arrives already gated (lib/portfolio.ts): a visible pick carries its
 * play, a locked one carries only its sport and, when known, its game. The
 * live feed is public scores; pickStatus() only ever runs on a visible pick's
 * track, which the server built only for picks this visitor can see.
 */

const RESULT_LABEL = { win: 'Win', loss: 'Loss', push: 'Push' } as const

function Team({ sport, abbrev, score }: { sport: string; abbrev: string; score: number | null }) {
  const logo = teamLogoUrl(sport, abbrev)
  return (
    <span className="pf-team">
      {logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={logo} alt="" width={28} height={28} loading="lazy" />
        : <span className="pf-team__mono" aria-hidden>{abbrev.slice(0, 3)}</span>}
      <b>{abbrev}</b>
      {score != null && <span className="pf-team__score">{score}</span>}
    </span>
  )
}

/** Both teams, with the score once the game is under way. */
function Matchup({ game, live }: { game: PortfolioGame; live: LiveGame | undefined }) {
  const started = live ? live.state !== 'pre' : game.status === 'in' || game.status === 'post'
  const away = started ? (live ? live.away.score : game.awayScore) : null
  const home = started ? (live ? live.home.score : game.homeScore) : null
  return (
    <div className="pf-matchup">
      <Team sport={game.sport} abbrev={game.away} score={away} />
      <span className="pf-matchup__at" aria-label="at">@</span>
      <Team sport={game.sport} abbrev={game.home} score={home} />
    </div>
  )
}

function When({ game, live }: { game: PortfolioGame | null; live: LiveGame | undefined }) {
  if (live) {
    return (
      <span className={`pf-when${live.state === 'in' ? ' is-live' : ''}`}>
        {live.state === 'in' && <i className="front-live__dot" aria-hidden />}
        {stateText(live)}
      </span>
    )
  }
  if (!game) return null
  if (game.status === 'post') return <span className="pf-when">Final</span>
  return <span className="pf-when">{kickoffText(game.kickoff)}</span>
}

function Tracker({ status, graded }: { status: LiveStatus | null; graded: boolean }) {
  if (graded || !status || status.tone === 'none') return null
  return (
    <p
      className={`pf-track pf-track--${status.tone}`}
      title={status.final ? 'What the final score implies. Official once Ed grades it.' : undefined}
    >
      {status.final === 'win' ? '✓ ' : status.final === 'loss' ? '✗ ' : ''}
      {status.text}
      {status.final && <em> · unofficial</em>}
    </p>
  )
}

function VisibleTile({ pick, live, status }: { pick: VisiblePick; live: LiveGame | undefined; status: LiveStatus | null }) {
  const provisional = !pick.result && status?.final ? status.final : null
  const cls = ['pf-tile', pick.result ? `is-graded is-${pick.result}` : provisional ? `is-final is-${provisional}` : '']
    .filter(Boolean).join(' ')
  return (
    <article className={cls}>
      <header className="pf-tile__top">
        <span className="pf-tag">{pick.sport}</span>
        {pick.isFree && <span className="pf-tag pf-tag--free">Free</span>}
        <When game={pick.game} live={live} />
        {pick.result && <span className={`pf-badge pf-badge--${pick.result}`}>{RESULT_LABEL[pick.result]}</span>}
      </header>
      {pick.game && <Matchup game={pick.game} live={live} />}
      <div className="pf-bet">
        <b>{pick.bet || '—'}</b>
        {pick.line && <span className="pf-bet__line">{minus(pick.line)}</span>}
      </div>
      {(pick.opponent || pick.vig) && (
        <p className="pf-meta">
          {[pick.opponent ? `vs ${pick.opponent}` : null, pick.vig ? `closed ${minus(pick.vig)}` : null].filter(Boolean).join(' · ')}
        </p>
      )}
      <Tracker status={status} graded={!!pick.result} />
      {pick.note && <p className="pf-note">{pick.note}</p>}
      {pick.game?.href && <Link href={pick.game.href} className="pf-tile__link">Game research</Link>}
    </article>
  )
}

function LockedTile({ pick, live }: { pick: LockedPick; live: LiveGame | undefined }) {
  const g = pick.game
  return (
    <article className="pf-tile pf-tile--locked">
      <header className="pf-tile__top">
        <span className="pf-tag">{pick.sport}</span>
        <When game={g} live={live} />
        <svg className="pf-lock" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
      </header>
      {g && <Matchup game={g} live={live} />}
      <div className="pf-bet pf-bet--locked">
        <b>{g ? <>Ed has a play on {g.away} @ {g.home}</> : <>Members&rsquo; play · {pick.sport}</>}</b>
      </div>
      <p className="pf-meta">The side and the number are on the members&rsquo; card.</p>
      <Link href="/win" className="pf-unlock">Unlock this play</Link>
    </article>
  )
}

export default function PortfolioCard({ days, tracks }: { days: CardDay[]; tracks: PickTrack[] }) {
  const { byId } = useLive()
  const trackOf = new Map(tracks.map(t => [t.pickId, t]))

  const liveOf = (p: CardPick) => (p.game ? byId.get(p.game.id) : undefined)
  const statusOf = (p: VisiblePick, live: LiveGame | undefined) => {
    const t = trackOf.get(p.id)
    return t && live ? pickStatus(t, live) : null
  }

  return (
    <>
      {days.map(day => {
        let w = 0, l = 0, pu = 0
        const rendered = day.picks.map(p => {
          const live = liveOf(p)
          if (p.kind === 'locked') return <LockedTile key={p.key} pick={p} live={live} />
          const status = statusOf(p, live)
          if (!p.result && status?.final) {
            if (status.final === 'win') w++
            else if (status.final === 'loss') l++
            else pu++
          }
          return <VisibleTile key={p.id} pick={p} live={live} status={status} />
        })
        const tally = w + l + pu > 0 ? `${w}-${l}${pu ? `-${pu}` : ''} so far, unofficial` : null
        return (
          <section key={day.date} className="pf-day" aria-label={day.date}>
            <header className="pf-day__hd">
              <h2>{day.isToday ? 'Today' : dayHeading(day.date)}</h2>
              <span>{day.picks.length} {day.picks.length === 1 ? 'play' : 'plays'}</span>
              {tally && <span className="pf-day__tally">{tally}</span>}
            </header>
            <div className="pf-tiles">{rendered}</div>
          </section>
        )
      })}
    </>
  )
}

function dayHeading(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}
