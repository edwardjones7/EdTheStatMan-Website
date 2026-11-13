// Injury reports from ESPN's public injuries feed.
//
// The NFL feed is ~8.7 MB (every athlete object in full), over Next's 2 MB
// per-fetch cache limit, so it is fetched uncached and only the slim result is
// cached, through unstable_cache, for 30 minutes. One big download per region
// per half hour; every page reads the slim copy.

import { unstable_cache } from 'next/cache'
import type { LiveSport } from '../live/types'
import { ESPN_HEADERS } from './news'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports'
const PATH: Partial<Record<LiveSport, string>> = {
  nfl: 'football/nfl',
  cfb: 'football/college-football',
  nba: 'basketball/nba',
}

export interface Injury {
  name: string
  pos: string | null
  status: 'Out' | 'Doubtful' | 'Questionable' | 'Day-To-Day'
  /** Body part ("Knee", "Hamstring"). A fact, unlike ESPN's written notes,
   *  which are their prose and are deliberately not carried. */
  detail: string | null
  date: string | null
}

/** Keyed by ESPN's full team name ("Arizona Cardinals"), which is what nfl_games stores. */
export type InjuryReport = Record<string, Injury[]>

/** Statuses that matter for this week's bet. IR and PUP are long-term and already priced. */
const KEEP: Injury['status'][] = ['Out', 'Doubtful', 'Questionable', 'Day-To-Day']
const RANK: Record<Injury['status'], number> = { Out: 0, Doubtful: 1, Questionable: 2, 'Day-To-Day': 3 }

/** Positions that move a line, first. */
const KEY_POS = new Set(['QB', 'RB', 'WR', 'TE', 'LT', 'EDGE', 'DE', 'CB', 'PG', 'SG', 'SF', 'PF', 'C', 'G', 'F'])

function status(raw: unknown): Injury['status'] | null {
  const s = String(raw ?? '').toLowerCase()
  if (s === 'out') return 'Out'
  if (s === 'doubtful') return 'Doubtful'
  if (s === 'questionable') return 'Questionable'
  if (s === 'day-to-day') return 'Day-To-Day'
  return null
}

async function fetchReport(sport: LiveSport): Promise<InjuryReport> {
  const path = PATH[sport]
  if (!path) return {}
  const res = await fetch(`${SITE}/${path}/injuries`, {
    headers: ESPN_HEADERS,
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const out: InjuryReport = {}
  for (const team of (json?.injuries ?? []) as any[]) {
    const list: Injury[] = []
    for (const i of (team?.injuries ?? []) as any[]) {
      const st = status(i?.status)
      if (!st || !KEEP.includes(st)) continue
      const part = String(i?.details?.type ?? '').trim()
      list.push({
        name: String(i?.athlete?.displayName ?? '').trim(),
        pos: i?.athlete?.position?.abbreviation ?? null,
        status: st,
        detail: part && !/^(not specified|other)$/i.test(part) ? part : null,
        date: i?.date ?? null,
      })
    }
    list.sort((a, b) =>
      RANK[a.status] - RANK[b.status] ||
      Number(KEY_POS.has(b.pos ?? '')) - Number(KEY_POS.has(a.pos ?? '')) ||
      String(b.date ?? '').localeCompare(String(a.date ?? ''))
    )
    if (team?.displayName && list.length > 0) out[String(team.displayName)] = list.filter(i => i.name).slice(0, 12)
  }
  return out
}

const cached = unstable_cache(
  async (sport: LiveSport) => {
    try {
      return await fetchReport(sport)
    } catch (e) {
      console.error(`[injuries] ${sport} failed: ${(e as Error).message}`)
      return {} as InjuryReport
    }
  },
  ['espn-injuries-v2'],
  { revalidate: 1800, tags: ['feed:injuries'] }
)

export async function loadInjuries(sport: LiveSport): Promise<InjuryReport> {
  if (!PATH[sport]) return {}
  return cached(sport)
}

export function isKeyPosition(pos: string | null): boolean {
  return pos != null && KEY_POS.has(pos)
}
