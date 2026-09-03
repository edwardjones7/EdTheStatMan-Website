// NFL hub domain helpers. Pure module — no server imports.
//
// `writeup_html` is elite-only IP. `nfl_games` has no public RLS select
// policy, so rows only ever reach the client through server pages — and only
// as PublicNflGame shapes built by toPublicGame(), which copies fields
// explicitly (never spread) so the writeup can never ride along.

/** Lines and context added by tier_ladder_06_desk_games.sql. All optional:
 *  the Research Desk renders correctly before that migration is applied, it
 *  simply shows no line. */
export interface GameOdds {
  spread_open?: number | null
  spread_current?: number | null
  spread_favorite?: string | null
  total_open?: number | null
  total_current?: number | null
  ml_home_open?: number | null
  ml_home_current?: number | null
  ml_away_open?: number | null
  ml_away_current?: number | null
  odds_provider?: string | null
  venue_name?: string | null
  venue_city?: string | null
  venue_state?: string | null
  venue_indoor?: boolean | null
  broadcast?: string | null
  home_record?: string | null
  away_record?: string | null
  sport?: string | null
}

export interface NflGame extends GameOdds {
  id: string
  espn_event_id: string
  season: number
  season_type: number // ESPN: 2 = regular season, 3 = postseason
  week: number
  kickoff: string | null
  status: string // pre | in | post
  home_team: string
  home_abbrev: string
  away_team: string
  away_abbrev: string
  home_score: number | null
  away_score: number | null
  slug: string
  brief: string
  writeup_html: string
  writeup_updated_at: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

/** Everything the public may see. The writeup itself is advertised, not sent. */
export interface PublicNflGame extends GameOdds {
  id: string
  season: number
  season_type: number
  week: number
  kickoff: string | null
  status: string
  home_team: string
  home_abbrev: string
  away_team: string
  away_abbrev: string
  home_score: number | null
  away_score: number | null
  slug: string
  brief: string
  has_writeup: boolean
  writeup_words: number
  is_published: boolean
}

export function writeupWordCount(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').trim()
  return text ? text.split(/\s+/).length : 0
}

/** Odds/context fields, copied one at a time like everything else here. */
function oddsOf(row: NflGame): GameOdds {
  return {
    sport: row.sport ?? 'nfl',
    spread_open: row.spread_open ?? null,
    spread_current: row.spread_current ?? null,
    spread_favorite: row.spread_favorite ?? null,
    total_open: row.total_open ?? null,
    total_current: row.total_current ?? null,
    ml_home_open: row.ml_home_open ?? null,
    ml_home_current: row.ml_home_current ?? null,
    ml_away_open: row.ml_away_open ?? null,
    ml_away_current: row.ml_away_current ?? null,
    odds_provider: row.odds_provider ?? null,
    venue_name: row.venue_name ?? null,
    venue_city: row.venue_city ?? null,
    venue_state: row.venue_state ?? null,
    venue_indoor: row.venue_indoor ?? null,
    broadcast: row.broadcast ?? null,
    home_record: row.home_record ?? null,
    away_record: row.away_record ?? null,
  }
}

export function toPublicGame(row: NflGame): PublicNflGame {
  return {
    ...oddsOf(row),
    id: row.id,
    season: row.season,
    season_type: row.season_type,
    week: row.week,
    kickoff: row.kickoff,
    status: row.status,
    home_team: row.home_team,
    home_abbrev: row.home_abbrev,
    away_team: row.away_team,
    away_abbrev: row.away_abbrev,
    home_score: row.home_score,
    away_score: row.away_score,
    slug: row.slug,
    brief: row.brief,
    has_writeup: writeupWordCount(row.writeup_html) > 0,
    writeup_words: writeupWordCount(row.writeup_html),
    is_published: row.is_published,
  }
}

/** Frozen at insert time — never regenerate for an existing row (SEO). */
export function buildGameSlug(
  season: number,
  seasonType: number,
  week: number,
  awayAbbrev: string,
  homeAbbrev: string
): string {
  const stage = seasonType === 3 ? `post${week}` : `wk${week}`
  return `${season}-${stage}-${awayAbbrev}-at-${homeAbbrev}`.toLowerCase()
}

const POSTSEASON_LABELS: Record<number, string> = {
  1: 'Wild Card',
  2: 'Divisional Round',
  3: 'Conference Championships',
  4: 'Pro Bowl',
  5: 'Super Bowl',
}

export function weekLabel(seasonType: number, week: number): string {
  if (seasonType === 3) return POSTSEASON_LABELS[week] ?? `Postseason Week ${week}`
  return `Week ${week}`
}

export interface WeekRef {
  season_type: number
  week: number
}

/**
 * The week to land on by default: the earliest week that still has an
 * unfinished game (kickoff within the last ~6h counts as live). Falls back to
 * the final week once the season is over, or the first week before it starts.
 */
export function currentWeekOf(games: Pick<NflGame, 'season_type' | 'week' | 'kickoff'>[], now: Date): WeekRef | null {
  if (games.length === 0) return null

  const byWeek = new Map<string, { ref: WeekRef; lastKickoff: number }>()
  for (const g of games) {
    const key = `${g.season_type}-${g.week}`
    const ms = g.kickoff ? new Date(g.kickoff).getTime() : 0
    const entry = byWeek.get(key)
    if (!entry) byWeek.set(key, { ref: { season_type: g.season_type, week: g.week }, lastKickoff: ms })
    else if (ms > entry.lastKickoff) entry.lastKickoff = ms
  }

  const weeks = [...byWeek.values()].sort(
    (a, b) => a.ref.season_type - b.ref.season_type || a.ref.week - b.ref.week
  )

  const GAME_WINDOW_MS = 6 * 60 * 60 * 1000
  const current = weeks.find(w => w.lastKickoff + GAME_WINDOW_MS > now.getTime())
  return (current ?? weeks[weeks.length - 1]).ref
}


/** "SEA -3.5" from a home-relative spread, or null when there is no line. */
export function spreadLabel(
  spread: number | null | undefined,
  homeAbbrev: string,
  awayAbbrev: string
): string | null {
  if (spread === null || spread === undefined) return null
  if (spread === 0) return 'PK'
  return spread < 0
    ? `${homeAbbrev} ${spread}`
    : `${awayAbbrev} -${spread}`
}

/** American odds with an explicit sign, e.g. -180 / +150. */
export function moneylineLabel(odds: number | null | undefined): string | null {
  if (odds === null || odds === undefined) return null
  return odds > 0 ? `+${odds}` : String(odds)
}

/**
 * How far a line has moved, as a display string, or null when we lack both
 * ends. Movement is the reason both numbers are stored.
 */
export function lineMove(
  open: number | null | undefined,
  current: number | null | undefined
): { delta: number; label: string } | null {
  if (open === null || open === undefined) return null
  if (current === null || current === undefined) return null
  const delta = Number((current - open).toFixed(1))
  if (delta === 0) return null
  return { delta, label: delta > 0 ? `+${delta}` : String(delta) }
}
