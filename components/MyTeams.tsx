'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { readFollows, onFollowsChange, type FollowedTeam } from '@/lib/follows'
import { useLiveFeed } from './live/useLiveFeed'
import type { LiveGame } from '@/lib/live/types'
import type { SearchGame, SearchResponse } from '@/lib/search-types'
import '@/styles/chrome.css'

/**
 * "My teams" on the front page: each followed team's live score or next game,
 * linking to its team page. Self-contained and client-only -- follows live in
 * this browser (lib/follows.ts) -- so it renders nothing for anyone who has not
 * followed a team, and nothing on the server.
 *
 * Live and today's games come from the shared /api/live poll. A team with no
 * game in that feed is looked up once through /api/search (CDN-cached), which
 * covers the next two weeks.
 */

const MAX_TEAMS = 8

// Same URL form as teamPath() in lib/desk-teams.ts, repeated here so the front
// page's client bundle does not pull in that module's school-name tables.
const teamPath = (sport: string, abbrev: string) =>
  `/desk/${encodeURIComponent(sport)}/team/${encodeURIComponent(abbrev.toLowerCase())}`

function when(iso: string | null): string {
  if (!iso) return 'Time TBD'
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })
}

function liveFor(games: LiveGame[], t: FollowedTeam): LiveGame | null {
  const mine = games.filter(g => g.sport === t.sport && (g.away.abbrev === t.abbrev || g.home.abbrev === t.abbrev))
  return mine.find(g => g.state === 'in') ?? mine.find(g => g.state === 'pre') ?? mine.find(g => g.state === 'post') ?? null
}

export default function MyTeams() {
  const [teams, setTeams] = useState<FollowedTeam[]>([])
  const [next, setNext] = useState<Record<string, SearchGame | null>>({})
  const feed = useLiveFeed()

  useEffect(() => {
    const sync = () => setTeams(readFollows().slice(0, MAX_TEAMS))
    sync()
    return onFollowsChange(sync)
  }, [])

  const live = useMemo(() => {
    const out: Record<string, LiveGame | null> = {}
    for (const t of teams) out[`${t.sport}|${t.abbrev}`] = liveFor(feed?.games ?? [], t)
    return out
  }, [teams, feed])

  // Teams the live feed has nothing upcoming for: one cached search each.
  useEffect(() => {
    if (!feed) return
    const missing = teams.filter(t => {
      const k = `${t.sport}|${t.abbrev}`
      const g = live[k]
      return !(k in next) && (!g || g.state === 'post')
    })
    if (missing.length === 0) return
    let cancelled = false
    Promise.all(missing.map(async t => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(t.name.toLowerCase())}`)
        if (!res.ok) return [t, null] as const
        const body = (await res.json()) as SearchResponse
        const g = body.games.find(x => x.sport === t.sport && (x.awayAbbrev === t.abbrev || x.homeAbbrev === t.abbrev)) ?? null
        return [t, g] as const
      } catch {
        return [t, null] as const
      }
    })).then(found => {
      if (cancelled) return
      setNext(prev => {
        const out = { ...prev }
        for (const [t, g] of found) out[`${t.sport}|${t.abbrev}`] = g
        return out
      })
    })
    return () => { cancelled = true }
  }, [teams, feed, live, next])

  if (teams.length === 0) return null

  return (
    <section className="myteams" aria-label="My teams">
      <header className="myteams__hd">
        <h2>My teams</h2>
        <small>Saved on this device</small>
      </header>
      <ul className="myteams__list">
        {teams.map(t => {
          const k = `${t.sport}|${t.abbrev}`
          const g = live[k]
          const n = next[k]
          let line: { text: string; live: boolean }
          if (g && g.state === 'in') {
            line = { text: `LIVE · ${g.away.abbrev} ${g.away.score ?? 0} – ${g.home.abbrev} ${g.home.score ?? 0} · ${g.detail}`, live: true }
          } else if (g && g.state === 'pre') {
            const home = g.home.abbrev === t.abbrev
            line = { text: `${home ? 'vs' : 'at'} ${home ? g.away.abbrev : g.home.abbrev} · ${when(g.kickoff)}`, live: false }
          } else if (n) {
            const home = n.homeAbbrev === t.abbrev
            line = { text: `Next: ${home ? 'vs' : 'at'} ${home ? n.awayAbbrev : n.homeAbbrev} · ${when(n.kickoff)}`, live: false }
          } else if (g && g.state === 'post') {
            line = { text: `Final · ${g.away.abbrev} ${g.away.score ?? 0} – ${g.home.abbrev} ${g.home.score ?? 0}`, live: false }
          } else {
            line = { text: k in next ? 'No game in the next two weeks' : 'Checking the schedule…', live: false }
          }
          return (
            <li key={k}>
              <Link href={teamPath(t.sport, t.abbrev)} className="myteams__team">
                {t.logo
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={t.logo} alt="" width={28} height={28} loading="lazy" className="myteams__logo" />
                  : <span className="myteams__logo myteams__logo--txt" aria-hidden="true">{t.abbrev}</span>}
                <span className="myteams__txt">
                  <span className="myteams__name">{t.name}</span>
                  <span className={`myteams__next${line.live ? ' is-live' : ''}`}>{line.text}</span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
