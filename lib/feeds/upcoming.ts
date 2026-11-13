// The Desk games coming up soon, for joining news and injuries to a matchup.
//
// The window is rounded to the hour so the cached query's URL (and so its
// cache key) only changes once an hour; a window built from Date.now() would
// be a new key, and a fresh Supabase read, on every request.

import { createCachedClient, DB_TAGS } from '../supabase/cached'
import { gamePath } from '../nfl'
import type { LiveSport } from '../live/types'

export interface UpcomingGame {
  id: string
  sport: LiveSport
  href: string
  kickoff: string | null
  status: string
  home_team: string
  away_team: string
  home_abbrev: string
  away_abbrev: string
  spread_open: number | null
  spread_current: number | null
  total_open: number | null
  total_current: number | null
}

const HOUR = 3600 * 1000

export async function loadUpcoming(sports: LiveSport[], days = 7): Promise<UpcomingGame[]> {
  const hour = Math.floor(Date.now() / HOUR) * HOUR
  const from = new Date(hour - 6 * HOUR).toISOString()
  const to = new Date(hour + days * 24 * HOUR).toISOString()
  try {
    const db = createCachedClient([DB_TAGS.games]) as any
    const lists = await Promise.all(sports.map(async sport => {
      const { data } = await db
        .from('nfl_games')
        .select('id, sport, slug, kickoff, status, home_team, away_team, home_abbrev, away_abbrev, spread_open, spread_current, total_open, total_current')
        .eq('sport', sport)
        .eq('is_published', true)
        .gte('kickoff', from)
        .lte('kickoff', to)
        .order('kickoff', { ascending: true })
        .limit(1000)
      return ((data ?? []) as any[]).map(r => ({ ...r, href: gamePath(sport, r.slug) })) as UpcomingGame[]
    }))
    return lists.flat()
  } catch (e) {
    console.error(`[upcoming] failed: ${(e as Error).message}`)
    return []
  }
}

/** The soonest game between these two teams (or involving one, if only one is given). */
export function findGame(games: UpcomingGame[], sport: string, teams: string[]): UpcomingGame | null {
  const set = new Set(teams.map(t => t.toLowerCase()))
  const of = (g: UpcomingGame) => Number(set.has(g.home_team.toLowerCase())) + Number(set.has(g.away_team.toLowerCase()))
  const scored = games.filter(g => g.sport === sport && of(g) > 0)
  if (scored.length === 0) return null
  const best = Math.max(...scored.map(of))
  // A story tagging one team in a two-team story about something else should
  // not pin to that team's game; require both when the story names two.
  if (teams.length >= 2 && best < 2) return null
  return scored.find(g => of(g) === best) ?? null
}
