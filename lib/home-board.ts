// The board panel in the homepage hero: this week's NFL games with their
// lines, how the lines have moved, and how much research is attached.
//
// Read the same way the Desk reads it (app/desk/[sport]/page.tsx): the newest
// published season, the current week by currentWeekOf(), and the curated
// system/trend link COUNTS per game. Counts are public on the Desk board too;
// the links themselves are what the Desk rung sells and never leave the server.
// Everything is shaped into display strings here so the hero is a plain server
// component with no row data in the browser.

import { createAdminClient } from './supabase/admin'
import { selectAll } from './supabase/select-all'
import { latestPublishedSeason } from './desk-teams'
import { deskSportLabel } from './desk'
import {
  currentWeekOf, weekLabel, spreadLabel, lineMove, gamePath, gameIsPlayed,
} from './nfl'

const SPORT = 'nfl'
/** Rows in the hero table. The full week is one click away. */
const MAX_ROWS = 6

export type MoveTone = 'up' | 'down' | 'flat'

export interface BoardRow {
  id: string
  href: string
  matchup: string
  when: string
  spread: string | null
  spreadMove: { label: string; tone: MoveTone } | null
  total: string | null
  totalMove: { label: string; tone: MoveTone } | null
  research: number
}

export interface HomeBoard {
  sport: string
  sportLabel: string
  title: string
  href: string
  games: number
  withResearch: number
  rows: BoardRow[]
}

interface Row {
  id: string
  season_type: number
  week: number
  kickoff: string | null
  kickoff_tbd?: boolean | null
  status: string
  home_team: string
  home_abbrev: string
  away_team: string
  away_abbrev: string
  home_score: number | null
  away_score: number | null
  slug: string
  spread_open: number | null
  spread_current: number | null
  total_open: number | null
  total_current: number | null
  broadcast: string | null
}

const COLUMNS =
  'id, season_type, week, kickoff, status, home_team, home_abbrev, away_team, away_abbrev, ' +
  'home_score, away_score, slug, spread_open, spread_current, total_open, total_current, broadcast'

/** A typographic minus for numbers set in mono. */
export function minus(s: string): string {
  return s.replace(/-/g, '−')
}

/** "Seattle Seahawks" -> "Seahawks"; the board's own rule for the NFL. */
function mascot(team: string): string {
  const parts = team.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : team
}

function move(open: number | null, current: number | null) {
  if (open == null || current == null) return null
  const m = lineMove(open, current)
  if (!m) return { label: 'no move', tone: 'flat' as const }
  return { label: minus(m.label), tone: (m.delta > 0 ? 'up' : 'down') as MoveTone }
}

function when(g: Row): string {
  if (g.status === 'post' && g.home_score != null && g.away_score != null) {
    const homeWon = g.home_score >= g.away_score
    const hi = Math.max(g.home_score, g.away_score)
    const lo = Math.min(g.home_score, g.away_score)
    return g.home_score === g.away_score
      ? `Final, ${hi}-${lo}`
      : `Final, ${homeWon ? g.home_abbrev : g.away_abbrev} ${hi}-${lo}`
  }
  if (g.status === 'in') {
    return `Live, ${g.away_abbrev} ${g.away_score ?? 0}, ${g.home_abbrev} ${g.home_score ?? 0}`
  }
  if (!g.kickoff) return 'Time TBD'
  const at = g.kickoff_tbd
    ? `${new Date(g.kickoff).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })}, time TBD`
    : new Date(g.kickoff).toLocaleString('en-US', {
        weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
      })
  return g.broadcast ? `${at}, ${g.broadcast}` : at
}

async function seasonRows(admin: any, season: number): Promise<Row[]> {
  const read = (cols: string) => selectAll<Row>(() =>
    admin.from('nfl_games').select(cols)
      .eq('sport', SPORT).eq('season', season).eq('is_published', true)
      .order('id', { ascending: true })
  )
  // kickoff_tbd arrives with desk_01_kickoff_tbd.sql; naming a missing column
  // fails the whole read, so fall back to the list without it.
  let res = await read(`${COLUMNS}, kickoff_tbd`)
  if (res.error) res = await read(COLUMNS)
  if (res.error) console.error(`[home-board] nfl_games read failed: ${res.error.message}`)
  return res.data
}

/** Null when there is no published week to show; the hero then drops the panel. */
export async function loadHomeBoard(now: Date = new Date()): Promise<HomeBoard | null> {
  try {
    const admin = createAdminClient() as any
    const season = await latestPublishedSeason(admin, SPORT)
    const all = await seasonRows(admin, season)
    const active = currentWeekOf(all, now)
    if (!active) return null

    const week = all.filter(g => g.season_type === active.season_type && g.week === active.week)
    const ids = week.map(g => g.id)

    const [sys, trends] = await Promise.all([
      admin.from('nfl_game_systems').select('game_id').in('game_id', ids),
      admin.from('nfl_game_trends').select('game_id').in('game_id', ids),
    ])
    const research: Record<string, number> = {}
    for (const r of [...(sys?.data ?? []), ...(trends?.data ?? [])] as { game_id: string }[]) {
      research[r.game_id] = (research[r.game_id] ?? 0) + 1
    }

    // Live first, then what is still to come in kickoff order, then finals
    // newest first: the reader came for tonight, not for Sunday's results.
    const ms = (g: Row) => (g.kickoff ? new Date(g.kickoff).getTime() : Number.MAX_SAFE_INTEGER)
    const rank = (g: Row) => (g.status === 'in' ? 0 : gameIsPlayed(g, now) ? 2 : 1)
    const ordered = [...week].sort((a, b) =>
      rank(a) - rank(b) || (rank(a) === 2 ? ms(b) - ms(a) : ms(a) - ms(b))
    )

    const rows: BoardRow[] = ordered.slice(0, MAX_ROWS).map(g => {
      const spread = spreadLabel(g.spread_current ?? g.spread_open, g.home_abbrev, g.away_abbrev)
      const total = g.total_current ?? g.total_open
      return {
        id: g.id,
        href: gamePath(SPORT, g.slug),
        matchup: `${mascot(g.away_team)} at ${mascot(g.home_team)}`,
        when: when(g),
        spread: spread ? minus(spread) : null,
        spreadMove: move(g.spread_open, g.spread_current),
        total: total != null ? String(total) : null,
        totalMove: move(g.total_open, g.total_current),
        research: research[g.id] ?? 0,
      }
    })

    return {
      sport: SPORT,
      sportLabel: deskSportLabel(SPORT),
      title: `${deskSportLabel(SPORT)}, ${weekLabel(active.season_type, active.week, SPORT, season).replace(/^Week/, 'week')}`,
      href: `/desk/${SPORT}`,
      games: week.length,
      withResearch: week.filter(g => (research[g.id] ?? 0) > 0).length,
      rows,
    }
  } catch (e) {
    console.error('[home-board] failed', e)
    return null
  }
}
