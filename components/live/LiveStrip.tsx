'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { LIVE_SPORTS, LIVE_SPORT_LABEL, type LiveGame, type LiveSport } from '@/lib/live/types'
import { useLive } from './LiveProvider'
import { spreadText, stateText } from './format'

/** What the server renders before the first poll lands (this week's NFL board). */
export interface StripSeed {
  id: string
  href: string
  short: string
  broadcast: string | null
  awayAbbrev: string
  homeAbbrev: string
  awayRecord: string | null
  homeRecord: string | null
  spread: string | null
  total: string | null
}

interface Props {
  seed: StripSeed[]
  seedTitle: string
  seedHref: string
  seedGames: number
}

const RANK = { in: 0, pre: 1, post: 2 } as const

function order(games: LiveGame[]): LiveGame[] {
  const t = (g: LiveGame) => (g.kickoff ? new Date(g.kickoff).getTime() : Number.MAX_SAFE_INTEGER)
  return [...games].sort((a, b) =>
    RANK[a.state] - RANK[b.state] || (a.state === 'post' ? t(b) - t(a) : t(a) - t(b))
  )
}

function Chip({ g }: { g: LiveGame }) {
  const live = g.state === 'in'
  const lead = g.home.score != null && g.away.score != null && g.home.score !== g.away.score
    ? (g.home.score > g.away.score ? 'home' : 'away') : null
  const spread = spreadText(g.spread, g)
  const moved = g.spreadJustMoved || g.totalJustMoved
  const body = (
    <>
      <span className="front-chip__t">
        <span className={live ? 'front-live' : undefined}>
          {live && <i className="front-live__dot" aria-hidden />}
          {stateText(g)}
        </span>
        {g.broadcast && g.state === 'pre' && <span>{g.broadcast}</span>}
      </span>
      {(['away', 'home'] as const).map(side => {
        const t = g[side]
        return (
          <span key={side} className={`front-chip__row${g.state === 'post' && lead && lead !== side ? ' is-lost' : ''}`}>
            <b>
              {t.abbrev}
              {g.possession === side && <i className="front-poss" aria-label="has the ball" />}
            </b>
            <span className={t.score != null ? 'front-chip__sc' : undefined}>{t.score ?? t.record ?? ''}</span>
          </span>
        )
      })}
      <span className="front-chip__row">
        <span className={`front-chip__ln${moved ? ' is-moved' : ''}`} title={moved ? 'Moved since the Desk last synced' : undefined}>
          {live && g.downDistance ? g.downDistance : spread ?? 'Off'}
        </span>
        <span>{live && g.redZone ? <em className="front-rz">RZ</em> : g.total ?? ''}</span>
      </span>
    </>
  )
  const label = `${g.away.abbrev} at ${g.home.abbrev}, ${stateText(g)}`
  return g.href
    ? <Link href={g.href} className={`front-chip${live ? ' is-live' : ''}`} aria-label={label}>{body}</Link>
    : <div className={`front-chip${live ? ' is-live' : ''}`} aria-label={label}>{body}</div>
}

/**
 * The scores bar: tabs per league, live games first, scores and clock while
 * they play, the line before and after. Server-renders this week's NFL board
 * and swaps to the live feed on the first poll.
 */
export default function LiveStrip({ seed, seedTitle, seedHref, seedGames }: Props) {
  const { games, ready } = useLive()
  const bySport = useMemo(() => {
    const m = new Map<LiveSport, LiveGame[]>()
    for (const s of LIVE_SPORTS) {
      const list = games.filter(g => g.sport === s)
      if (list.length > 0) m.set(s, order(list))
    }
    return m
  }, [games])

  const tabs = Array.from(bySport.keys())
  const liveCount = (s: LiveSport) => bySport.get(s)?.filter(g => g.state === 'in').length ?? 0
  const preferred = [...tabs].sort((a, b) => liveCount(b) - liveCount(a))[0] ?? null
  const [picked, setPicked] = useState<LiveSport | null>(null)
  const active = picked && bySport.has(picked) ? picked : preferred

  if (!ready || !active) {
    if (seed.length === 0) return null
    return (
      <div className="front-strip">
        <div className="container front-strip__inner">
          <Link href={seedHref} className="front-strip__league">
            <b>{seedTitle.replace(/, week/, ' · WK').toUpperCase()}</b>
            <small>{seedGames} games</small>
          </Link>
          <div className="front-strip__chips" tabIndex={0} role="region" aria-label={`${seedTitle} lines`}>
            {seed.map(r => (
              <Link key={r.id} href={r.href} className="front-chip">
                <span className="front-chip__t"><span>{r.short}</span>{r.broadcast && <span>{r.broadcast.split(',')[0]}</span>}</span>
                <span className="front-chip__row"><b>{r.awayAbbrev}</b><span>{r.awayRecord ?? ''}</span></span>
                <span className="front-chip__row"><b>{r.homeAbbrev}</b><span>{r.homeRecord ?? ''}</span></span>
                <span className="front-chip__row"><span className="front-chip__ln">{r.spread ?? 'Off'}</span><span>{r.total ?? ''}</span></span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const list = bySport.get(active) ?? []
  const live = liveCount(active)
  return (
    <div className="front-strip">
      <div className="container front-strip__inner">
        <div className="front-strip__league">
          <div className="front-strip__tabs" role="tablist" aria-label="League">
            {tabs.map(s => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={s === active}
                className={`front-strip__tab${s === active ? ' is-on' : ''}`}
                onClick={() => setPicked(s)}
              >
                {LIVE_SPORT_LABEL[s]}
                {liveCount(s) > 0 && <i className="front-live__dot" aria-label={`${liveCount(s)} live`} />}
              </button>
            ))}
          </div>
          <small>{live > 0 ? `${live} live · ` : ''}{list.length} games</small>
        </div>
        <div className="front-strip__chips" tabIndex={0} role="region" aria-label={`${LIVE_SPORT_LABEL[active]} scores`}>
          {list.map(g => <Chip key={g.espnId} g={g} />)}
        </div>
      </div>
    </div>
  )
}
