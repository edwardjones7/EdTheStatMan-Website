// The board panel in the homepage hero: today's games across every Desk sport,
// with their lines, how the lines have moved, and how much research is attached.
// On a day with nothing left to play it falls back to this week's NFL games.
//
// The fallback reads the way the Desk reads it (app/desk/[sport]/page.tsx): the
// newest published season, the current week by currentWeekOf(). Both use the
// curated system/trend link COUNTS per game. Counts are public on the Desk board too;
// the links themselves are what the Desk rung sells and never leave the server.
// Everything is shaped into display strings here so the hero is a plain server
// component with no row data in the browser.

import { createAdminClient } from './supabase/admin'
import { selectAll } from './supabase/select-all'
import { latestPublishedSeason, teamShortName } from './desk-teams'
import { deskSportLabel, deskToday, DESK_SPORTS } from './desk'
import {
  currentWeekOf, weekLabel, spreadLabel, lineMove, gamePath, gameIsPlayed,
} from './nfl'

const SPORT = 'nfl'
/** Rows in the hero table. The full board is one click away. */
const MAX_ROWS = 6
/** Which league a visitor expects first when two games are otherwise level. */
const SPORT_ORDER = ['nfl', 'nba', 'cfb', 'cbb']
/** Ids per research read. They ride in the query string. */
const ID_CHUNK = 100
const HOUR_MS = 60 * 60 * 1000

export type MoveTone = 'up' | 'down' | 'flat'

export interface BoardRow {
  id: string
  href: string
  /** "CBB" on the mixed board. Null when every row is the same league. */
  sportTag: string | null
  matchup: string
  when: string
  spread: string | null
  spreadMove: { label: string; tone: MoveTone } | null
  /** "BAL −4.5" when the spread has moved since it opened, else null. A
   *  signed delta is home-relative and reads as nonsense beside an away
   *  favourite ("JAX −9.5, +14"); the opening number is how bettors read it. */
  spreadOpen: string | null
  total: string | null
  totalMove: { label: string; tone: MoveTone } | null
  /** The opening total when it has moved, else null. */
  totalOpen: string | null
  research: number
}

export interface HomeBoard {
  title: string
  href: string
  /** The link under the table, e.g. "The full board". */
  allLabel: string
  /** The line beside that link. */
  others: string
  games: number
  withResearch: number
  rows: BoardRow[]
}

interface Row {
  id: string
  sport?: string
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
  'id, sport, season_type, week, kickoff, status, home_team, home_abbrev, away_team, away_abbrev, ' +
  'home_score, away_score, slug, spread_open, spread_current, total_open, total_current, broadcast'

/** A typographic minus for numbers set in mono. Only before a number: M-OH keeps its hyphen. */
export function minus(s: string): string {
  return s.replace(/(^|\s)-(?=[\d.])/g, '$1−')
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

/** The opening number, formatted, but only when the line has since moved. */
function opened(
  open: number | null,
  current: number | null,
  fmt: (v: number) => string | null
): string | null {
  if (open == null || current == null || open === current) return null
  return fmt(open)
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

/**
 * Every published game on the Desk's today, across the leagues. The window is
 * read wide and filtered by deskToday(), so a 1am ET tip stays on the slate it
 * belongs to. A game with no start time has no place on a today board: its
 * kickoff is a midnight placeholder.
 */
async function todayRows(admin: any, now: Date): Promise<Row[]> {
  const read = (cols: string) => admin.from('nfl_games').select(cols)
    .in('sport', [...DESK_SPORTS]).eq('is_published', true)
    .gte('kickoff', new Date(now.getTime() - 24 * HOUR_MS).toISOString())
    .lte('kickoff', new Date(now.getTime() + 30 * HOUR_MS).toISOString())
    .order('kickoff', { ascending: true })
  let res = await read(`${COLUMNS}, kickoff_tbd`)
  if (res.error) res = await read(COLUMNS)
  if (res.error) console.error(`[home-board] today read failed: ${res.error.message}`)
  const today = deskToday(now)
  return ((res.data ?? []) as Row[]).filter(g =>
    g.kickoff && !g.kickoff_tbd && deskToday(new Date(g.kickoff)) === today
  )
}

async function researchCounts(admin: any, ids: string[]): Promise<Record<string, number>> {
  const research: Record<string, number> = {}
  for (let i = 0; i < ids.length; i += ID_CHUNK) {
    const chunk = ids.slice(i, i + ID_CHUNK)
    const [sys, trends] = await Promise.all([
      admin.from('nfl_game_systems').select('game_id').in('game_id', chunk),
      admin.from('nfl_game_trends').select('game_id').in('game_id', chunk),
    ])
    for (const r of [...(sys?.data ?? []), ...(trends?.data ?? [])] as { game_id: string }[]) {
      research[r.game_id] = (research[r.game_id] ?? 0) + 1
    }
  }
  return research
}

function boardRow(g: Row, sport: string, research: number, tagged: boolean): BoardRow {
  const spread = spreadLabel(g.spread_current ?? g.spread_open, g.home_abbrev, g.away_abbrev)
  const total = g.total_current ?? g.total_open
  // College reads by school; a list of mascots cannot be read.
  const name = (abbrev: string, team: string) =>
    sport === 'cfb' || sport === 'cbb' ? teamShortName(sport, abbrev, team) : mascot(team)
  return {
    id: g.id,
    href: gamePath(sport, g.slug),
    sportTag: tagged ? sport.toUpperCase() : null,
    matchup: `${name(g.away_abbrev, g.away_team)} at ${name(g.home_abbrev, g.home_team)}`,
    when: when(g),
    spread: spread ? minus(spread) : null,
    spreadMove: move(g.spread_open, g.spread_current),
    spreadOpen: opened(g.spread_open, g.spread_current, v => {
      const l = spreadLabel(v, g.home_abbrev, g.away_abbrev)
      return l ? minus(l) : null
    }),
    total: total != null ? String(total) : null,
    totalMove: move(g.total_open, g.total_current),
    totalOpen: opened(g.total_open, g.total_current, v => String(v)),
    research,
  }
}

/**
 * Today's board, or null when nothing is left to play today.
 *
 * Six rows out of what can be a hundred games, so the choice matters: live
 * first, then games carrying research, then games with a posted line, then the
 * bigger league. A college board's non-Division I games have no line, and
 * leading with those would read as an empty product.
 */
async function todayBoard(admin: any, now: Date): Promise<HomeBoard | null> {
  const today = await todayRows(admin, now)
  const open = today.filter(g => g.status === 'in' || !gameIsPlayed(g, now))
  if (open.length === 0) return null

  const research = await researchCounts(admin, today.map(g => g.id))
  const count = (g: Row) => research[g.id] ?? 0
  const priced = (g: Row) => (g.spread_current ?? g.spread_open) != null
  const league = (g: Row) => SPORT_ORDER.indexOf(g.sport ?? SPORT)
  const ms = (g: Row) => new Date(g.kickoff as string).getTime()

  const chosen = [...open]
    .sort((a, b) =>
      Number(b.status === 'in') - Number(a.status === 'in') ||
      count(b) - count(a) ||
      Number(priced(b)) - Number(priced(a)) ||
      league(a) - league(b) ||
      ms(a) - ms(b)
    )
    .slice(0, MAX_ROWS)
    .sort((a, b) => Number(b.status === 'in') - Number(a.status === 'in') || ms(a) - ms(b))

  return {
    title: 'Today on the Desk',
    href: '/desk',
    allLabel: 'The full board',
    others: 'NFL, college football, NBA and college basketball, every game.',
    games: today.length,
    withResearch: today.filter(g => count(g) > 0).length,
    rows: chosen.map(g => boardRow(g, g.sport ?? SPORT, count(g), true)),
  }
}

/** Null when there is nothing to show; the hero then drops the panel. */
export async function loadHomeBoard(now: Date = new Date()): Promise<HomeBoard | null> {
  try {
    const admin = createAdminClient() as any
    const board = await todayBoard(admin, now)
    if (board) return board

    const season = await latestPublishedSeason(admin, SPORT)
    const all = await seasonRows(admin, season)
    const active = currentWeekOf(all, now)
    if (!active) return null

    const week = all.filter(g => g.season_type === active.season_type && g.week === active.week)
    const research = await researchCounts(admin, week.map(g => g.id))

    // Live first, then what is still to come in kickoff order, then finals
    // newest first: the reader came for tonight, not for Sunday's results.
    const ms = (g: Row) => (g.kickoff ? new Date(g.kickoff).getTime() : Number.MAX_SAFE_INTEGER)
    const rank = (g: Row) => (g.status === 'in' ? 0 : gameIsPlayed(g, now) ? 2 : 1)
    const ordered = [...week].sort((a, b) =>
      rank(a) - rank(b) || (rank(a) === 2 ? ms(b) - ms(a) : ms(a) - ms(b))
    )

    const rows = ordered.slice(0, MAX_ROWS).map(g => boardRow(g, SPORT, research[g.id] ?? 0, false))

    return {
      title: `${deskSportLabel(SPORT)}, ${weekLabel(active.season_type, active.week, SPORT, season).replace(/^Week/, 'week')}`,
      href: `/desk/${SPORT}`,
      allLabel: `The full ${deskSportLabel(SPORT)} board`,
      others: 'College football, NBA and college basketball are on the Desk too.',
      games: week.length,
      withResearch: week.filter(g => (research[g.id] ?? 0) > 0).length,
      rows,
    }
  } catch (e) {
    console.error('[home-board] failed', e)
    return null
  }
}
