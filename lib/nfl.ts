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

/**
 * Frozen at insert time — never regenerate for an existing row (SEO).
 *
 * Every sport but NFL carries its own prefix, because `slug` is UNIQUE across
 * the whole table and college shares abbreviations with the pros: MIA, HOU and
 * CIN are each both an NFL franchise and an FBS program, so an unprefixed
 * college slug can collide with a pro game in the same season and week. The
 * sync inserts a season as one batch, so a collision does not just lose that
 * row, it takes the batch with it. NFL slugs are left bare because they are
 * already published and indexed.
 */
export function buildGameSlug(
  sport: string,
  season: number,
  seasonType: number,
  week: number,
  awayAbbrev: string,
  homeAbbrev: string
): string {
  const stage = seasonType === 3 ? `post${week}` : `wk${week}`
  const prefix = sport === 'nfl' ? '' : `${sport}-`
  return `${prefix}${season}-${stage}-${awayAbbrev}-at-${homeAbbrev}`.toLowerCase()
}

const POSTSEASON_LABELS: Record<string, Record<number, string>> = {
  nfl: {
    1: 'Wild Card',
    2: 'Divisional Round',
    3: 'Conference Championships',
    4: 'Pro Bowl',
    5: 'Super Bowl',
  },
  // ESPN hands college the whole bowl and playoff slate as postseason week 1,
  // so there is one label rather than a round-by-round ladder.
  cfb: {
    1: 'Bowls & Playoff',
  },
}

export function weekLabel(seasonType: number, week: number, sport = 'nfl'): string {
  if (seasonType === 3) {
    const labels = POSTSEASON_LABELS[sport] ?? POSTSEASON_LABELS.nfl
    return labels[week] ?? `Postseason Week ${week}`
  }
  return `Week ${week}`
}

export interface WeekRef {
  season_type: number
  week: number
}

/**
 * How long after kickoff a game is still assumed to be in progress when its
 * status has not caught up. Generous on purpose: it only decides how quickly a
 * finished week gives way to the next one.
 */
const GAME_WINDOW_MS = 8 * 60 * 60 * 1000

/**
 * The week to land on by default: the earliest week that still has a game
 * which has not been played. Falls back to the final week once the season is
 * over, or the first week before it starts.
 *
 * A game counts as unplayed when ESPN has not marked it `post` AND its kickoff
 * is not already well behind us. Both halves matter, and neither is enough on
 * its own:
 *
 *   - Status alone would pin the board on a stale week forever if the sync
 *     stopped running, since nothing would ever move off `pre`.
 *   - Kickoff alone is a guess about when play ended, which is what this used
 *     to do. It held the board on a finished week for hours after the last
 *     whistle, and could hand it over early on a game that ran long.
 *
 * Read `status`, never the score: an unplayed game is 0-0, not null.
 */
export function currentWeekOf(
  games: Pick<NflGame, 'season_type' | 'week' | 'kickoff' | 'status'>[],
  now: Date
): WeekRef | null {
  if (games.length === 0) return null

  const byWeek = new Map<string, { ref: WeekRef; unplayed: boolean }>()
  for (const g of games) {
    const key = `${g.season_type}-${g.week}`
    const kickoff = g.kickoff ? new Date(g.kickoff).getTime() : 0
    // A game with no kickoff time is scheduled but unplaced (a bowl slot, a
    // flexed window), so it counts as still to come.
    const started = kickoff > 0 && kickoff + GAME_WINDOW_MS <= now.getTime()
    const unplayed = g.status !== 'post' && !started

    const entry = byWeek.get(key)
    if (!entry) byWeek.set(key, { ref: { season_type: g.season_type, week: g.week }, unplayed })
    else if (unplayed) entry.unplayed = true
  }

  const weeks = [...byWeek.values()].sort(
    (a, b) => a.ref.season_type - b.ref.season_type || a.ref.week - b.ref.week
  )

  const current = weeks.find(w => w.unplayed)
  return (current ?? weeks[weeks.length - 1]).ref
}


/**
 * A day's worth of games on the board, already ordered.
 */
export interface SlateDay<G> {
  label: string
  games: G[]
  /** Every game on this day has been played. */
  done: boolean
}

type SlateGame = Pick<PublicNflGame, 'kickoff' | 'status'>

/** "Sunday, Sep 14" in league time, which is how a slate is read. */
export function slateDayLabel(kickoff: string | null): string {
  if (!kickoff) return 'TBD'
  return new Date(kickoff).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  })
}

/**
 * Group a week into days and order it by what the reader came for.
 *
 * Straight chronological order buries the game being played right now beneath
 * every game that finished earlier the same day, so the most live information
 * on the page is the part you have to scroll to. Instead: live games lead their
 * day, then whatever has not kicked off, then finals; and a day that is
 * entirely over sinks below the days that still have something to come.
 *
 * The sorts are stable and the day sink is keyed only on `done`, so the slate
 * keeps its chronological shape inside each of those two groups. Nothing is
 * reordered at all until something has actually finished.
 *
 * ORDERED ON `status`, NEVER ON A CLOCK READ. This runs during render in a
 * client component: comparing kickoff times against Date.now() would let the
 * browser order the board differently than the HTML it is hydrating. `status`
 * comes from the server, so both renders agree.
 */
export function groupSlate<G extends SlateGame>(games: G[]): SlateDay<G>[] {
  const RELEVANCE: Record<string, number> = { in: 0, pre: 1, post: 2 }
  const relevance = (g: SlateGame) => RELEVANCE[g.status] ?? 1
  const ms = (g: SlateGame) => (g.kickoff ? new Date(g.kickoff).getTime() : 0)

  // Games arrive in kickoff order, so consecutive runs are days.
  const days: SlateDay<G>[] = []
  for (const g of games) {
    const label = slateDayLabel(g.kickoff)
    const last = days[days.length - 1]
    if (last && last.label === label) last.games.push(g)
    else days.push({ label, games: [g], done: false })
  }

  for (const day of days) {
    day.games.sort((a, b) => relevance(a) - relevance(b) || ms(a) - ms(b))
    day.done = day.games.every(g => g.status === 'post')
  }

  return days.sort((a, b) => Number(a.done) - Number(b.done))
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
