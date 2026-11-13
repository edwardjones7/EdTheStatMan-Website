// Live scores from ESPN's public scoreboard (cdn.espn.com, free and keyless;
// site.api.espn.com 403s, see vault Traps), joined to the Desk's own games.
//
// COST. This is called by /api/live, which the CDN caches for ~20s, so ESPN
// sees about three requests a minute per sport however many people are on the
// page, and Supabase sees one cached read per sport per five minutes. Live
// scores must never become a per-visitor database read: that is what blew the
// Free plan quota in Nov 2026.

import { createCachedClient, DB_TAGS } from '../supabase/cached'
import { parseOdds } from '../espn'
import { gamePath } from '../nfl'
import type { LiveFeed, LiveGame, LiveSport, LiveState } from './types'

const CDN = 'https://cdn.espn.com/core'

/** ESPN path and query per sport. College feeds default to the top 25 only;
 *  the group widens them to every FBS / D-I game, then we keep only the games
 *  the Desk publishes. */
const FEED: Record<LiveSport, { path: string; query: string; deskOnly: boolean }> = {
  nfl: { path: 'nfl', query: '', deskOnly: false },
  nba: { path: 'nba', query: '', deskOnly: false },
  cfb: { path: 'college-football', query: '&groups=80', deskOnly: true },
  cbb: { path: 'mens-college-basketball', query: '&groups=50&limit=400', deskOnly: true },
}

/** How long a fetched ESPN scoreboard is reused, in seconds. */
export const LIVE_TTL = 20

interface DeskRow {
  id: string
  slug: string
  espn_event_id: string
  spread_open: number | null
  spread_current: number | null
  total_open: number | null
  total_current: number | null
}

function clockSeconds(display: unknown): number | null {
  if (typeof display !== 'string') return null
  const m = display.match(/^(\d+):(\d{2})(?:\.\d+)?$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  const s = Number(display)
  return Number.isFinite(s) ? s : null
}

function score(v: unknown): number | null {
  const n = Number(v)
  return v === undefined || v === null || v === '' || !Number.isFinite(n) ? null : n
}

function parse(event: any, sport: LiveSport): Omit<LiveGame, 'id' | 'href' | 'spreadOpen' | 'totalOpen' | 'spreadJustMoved' | 'totalJustMoved'> | null {
  const comp = event?.competitions?.[0]
  const teams: any[] = comp?.competitors ?? []
  const home = teams.find(t => t.homeAway === 'home')
  const away = teams.find(t => t.homeAway === 'away')
  if (!event?.id || !home || !away) return null

  const type = event.status?.type ?? comp?.status?.type ?? {}
  const state: LiveState = type.state === 'in' || type.state === 'post' ? type.state : 'pre'
  const status = event.status ?? comp?.status ?? {}
  const homeAbbrev = home.team?.abbreviation ?? '?'
  const awayAbbrev = away.team?.abbreviation ?? '?'
  const odds = parseOdds(comp, homeAbbrev, awayAbbrev)
  const sit = comp?.situation ?? null
  const possId = sit?.possession
  const possession = possId && String(possId) === String(home.team?.id) ? 'home'
    : possId && String(possId) === String(away.team?.id) ? 'away' : null
  const record = (t: any) => t.records?.find((r: any) => r.type === 'total')?.summary ?? t.records?.[0]?.summary ?? null

  return {
    espnId: String(event.id),
    sport,
    state,
    detail: String(type.shortDetail ?? type.detail ?? ''),
    period: Number(status.period ?? 0),
    clockSeconds: state === 'in' ? clockSeconds(status.displayClock) : null,
    kickoff: event.date ?? comp?.date ?? null,
    away: { abbrev: awayAbbrev, score: state === 'pre' ? null : score(away.score), record: record(away) },
    home: { abbrev: homeAbbrev, score: state === 'pre' ? null : score(home.score), record: record(home) },
    possession: state === 'in' ? possession : null,
    downDistance: state === 'in' ? (sit?.shortDownDistanceText ?? sit?.downDistanceText ?? null) : null,
    redZone: state === 'in' && Boolean(sit?.isRedZone),
    spread: odds.spread_current,
    total: odds.total_current,
    broadcast: comp?.broadcasts?.[0]?.names?.[0] ?? comp?.geoBroadcasts?.[0]?.media?.shortName ?? null,
  }
}

async function fetchSport(sport: LiveSport): Promise<LiveGame[]> {
  const f = FEED[sport]
  let events: any[] = []
  try {
    const res = await fetch(`${CDN}/${f.path}/scoreboard?xhr=1${f.query}`, {
      next: { revalidate: LIVE_TTL },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    events = json?.content?.sbData?.events ?? []
  } catch (e) {
    console.error(`[live] ${sport} scoreboard failed: ${(e as Error).message}`)
    return []
  }

  const parsed = events.map(e => parse(e, sport)).filter(Boolean) as NonNullable<ReturnType<typeof parse>>[]
  if (parsed.length === 0) return []

  // Join to the Desk: one cached read per sport, keyed by ESPN's event id.
  const desk = new Map<string, DeskRow>()
  try {
    const db = createCachedClient([DB_TAGS.games]) as any
    const ids = parsed.map(g => g.espnId)
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await db
        .from('nfl_games')
        .select('id, slug, espn_event_id, spread_open, spread_current, total_open, total_current')
        .eq('is_published', true)
        .in('espn_event_id', ids.slice(i, i + 150))
      for (const r of (data ?? []) as DeskRow[]) desk.set(String(r.espn_event_id), r)
    }
  } catch (e) {
    console.error(`[live] ${sport} desk join failed: ${(e as Error).message}`)
  }

  const out: LiveGame[] = []
  for (const g of parsed) {
    const row = desk.get(g.espnId)
    if (f.deskOnly && !row) continue
    out.push({
      ...g,
      id: row?.id ?? null,
      href: row ? gamePath(sport, row.slug) : null,
      spreadOpen: row?.spread_open ?? null,
      totalOpen: row?.total_open ?? null,
      spreadJustMoved: Boolean(row && g.spread != null && row.spread_current != null && g.spread !== row.spread_current),
      totalJustMoved: Boolean(row && g.total != null && row.total_current != null && g.total !== row.total_current),
    })
  }
  return out
}

export async function loadLiveFeed(sports: LiveSport[]): Promise<LiveFeed> {
  const lists = await Promise.all(sports.map(fetchSport))
  const games = lists.flat()
  return { updatedAt: new Date().toISOString(), games }
}
