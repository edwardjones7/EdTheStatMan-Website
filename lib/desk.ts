// Sport vocabulary, defined once.
//
// These lists were previously duplicated across SportTabsSystem.tsx,
// TrendsFilter.tsx, AdminSystemsTab.tsx and AdminTrendsTab.tsx, plus a CHECK
// constraint in betting_tables.sql. Adding a sport meant editing five places
// and remembering the migration. New code should import from here.

export const SPORTS = ['nfl', 'nflpre', 'cfb', 'cfl', 'nba', 'wnba', 'cbb'] as const
export type Sport = (typeof SPORTS)[number]

export const SPORT_LABEL: Record<Sport, string> = {
  nfl: 'NFL',
  nflpre: 'NFL Preseason',
  cfb: 'College Football',
  cfl: 'CFL',
  nba: 'NBA',
  wnba: 'WNBA',
  cbb: 'College Basketball',
}

/** Badge-width codes. SPORT_LABEL is too long for a table cell. */
export const SPORT_SHORT: Record<Sport, string> = {
  nfl: 'NFL',
  nflpre: 'NFL PRE',
  cfb: 'CFB',
  cfl: 'CFL',
  nba: 'NBA',
  wnba: 'WNBA',
  cbb: 'CBB',
}

/**
 * Sports the Research Desk currently has a schedule for.
 *
 * Kept separate from SPORTS because the Vault carries systems and trends for
 * sports the Desk has no game data for yet. Adding a sport here is content
 * work — the tables and routes are already keyed by sport — but only do it once
 * the sync actually populates that league.
 */
export const DESK_SPORTS = ['nfl', 'cfb', 'nba', 'cbb'] as const
export type DeskSport = (typeof DESK_SPORTS)[number]

/**
 * Leagues whose "weeks" we have to make up.
 *
 * Football arrives from ESPN already in weeks, and the whole Desk -- the rail,
 * the URL, the desk note, closing research on a played week -- is keyed on
 * (season, season_type, week). Basketball has no week at all: it is a game most
 * nights from October to June, and ESPN's feed is keyed by date. Rather than
 * fork every one of those consumers, a basketball week is DERIVED from the game
 * date: Monday to Sunday in Eastern time, counted from the Monday on or before
 * 1 October of the year the season starts. Deterministic, so the sync, the
 * board and a slug all agree on which week a game belongs to without storing
 * anything new, and nfl_games needs no migration -- its sport CHECK already
 * allowed nba and cbb.
 *
 * The number is an internal key. Readers see "Week of Oct 20", never "Week 4".
 */
const DATE_WEEK_SPORTS: ReadonlySet<string> = new Set(['nba', 'cbb'])

export function weeksFromDates(sport: string | null | undefined): boolean {
  return DATE_WEEK_SPORTS.has(sport ?? '')
}

/**
 * How far the ESPN sweep runs for each league, because the seasons are not
 * the same shape.
 *
 * FOOTBALL. NFL is 18 regular weeks and 5 postseason weeks (wild card through
 * the Pro Bowl and Super Bowl). College is 16 regular weeks -- week 15 is
 * Army-Navy and week 16 the last of the conference title games -- and the
 * entire bowl and playoff slate arrives as postseason week 1, 46 games at once.
 * Probed against cdn.espn.com 2026-09-05: college postseason weeks 2 and 3
 * answer with HTML rather than JSON, so sweeping them is a reported failure on
 * every run rather than an empty week. Ask for what exists.
 *
 * BASKETBALL. Derived weeks (see weeksFromDates), so `regular` is the span of
 * week numbers to sweep and `post` is 0 -- the postseason is the same calendar,
 * and each game carries its own season type. NBA week 3 is mid-October, before
 * opening night, and week 39 is past the Finals; college opens in the first
 * week of November (week 5) and the title game is early April (inside 28).
 * Weeks with no games come back empty, so the margins cost a request, not an
 * error.
 */
export const DESK_SWEEP: Record<DeskSport, { regular: number; post: number; from?: number }> = {
  nfl: { regular: 18, post: 5 },
  cfb: { regular: 16, post: 1 },
  nba: { from: 3, regular: 39, post: 0 },
  cbb: { from: 5, regular: 28, post: 0 },
}

export function deskSweep(sport: string): { regular: number; post: number; from?: number } {
  return DESK_SWEEP[sport as DeskSport] ?? DESK_SWEEP.nfl
}

/** Every week a full-season sync asks ESPN for. */
export function deskSeasonTargets(sport: string): { seasonType: number; week: number }[] {
  const sweep = deskSweep(sport)
  const out: { seasonType: number; week: number }[] = []
  for (let w = sweep.from ?? 1; w <= sweep.regular; w++) out.push({ seasonType: 2, week: w })
  for (let w = 1; w <= sweep.post; w++) out.push({ seasonType: 3, week: w })
  return out
}

/**
 * The week after this one, rolling into the postseason at the end of a
 * football regular season rather than asking for a week that does not exist.
 * A derived basketball week just counts on: the calendar decides the season
 * type, game by game.
 */
export function nextDeskWeek(
  sport: string,
  active: { season_type: number; week: number }
): { season_type: number; week: number } {
  if (weeksFromDates(sport)) return { season_type: active.season_type, week: active.week + 1 }
  const sweep = deskSweep(sport)
  if (active.season_type === 2 && active.week < sweep.regular) return { season_type: 2, week: active.week + 1 }
  if (active.season_type === 2) return { season_type: 3, week: 1 }
  return { season_type: 3, week: active.week + 1 }
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/** "2026-10-20" for the calendar day this instant falls on in Eastern time. */
export function easternDate(when: string | Date): string {
  // en-CA formats as yyyy-mm-dd, which is the one shape Date.parse reads
  // unambiguously.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(when))
}

/** UTC midnight of the Monday on or before 1 October of the season's first year. */
function seasonAnchor(season: number): number {
  const oct1 = Date.UTC(season - 1, 9, 1)
  const sinceMonday = (new Date(oct1).getUTCDay() + 6) % 7
  return oct1 - sinceMonday * DAY_MS
}

/**
 * The derived week a basketball game belongs to. `season` is ESPN's season
 * year, which is the year the season ENDS: 2025-26 is 2026.
 */
export function dateWeekOf(season: number, when: string | Date): number {
  const day = Date.parse(`${easternDate(when)}T00:00:00Z`)
  return Math.floor((day - seasonAnchor(season)) / WEEK_MS) + 1
}

/** The Monday a derived week starts on, as a UTC-midnight Date. */
export function dateWeekStart(season: number, week: number): Date {
  return new Date(seasonAnchor(season) + (week - 1) * WEEK_MS)
}

/**
 * The season a league is in (or about to start) on a given day.
 *
 * Football seasons are named for the year they start in. Basketball seasons
 * span two years and ESPN names them for the year they END, so from August
 * on the season to show is next year's: in October 2026 the NBA is in its
 * 2027 season, and `new Date().getFullYear()` would point at the one that
 * finished in June.
 */
export function defaultDeskSeason(sport: string, now: Date = new Date()): number {
  const [y, m] = easternDate(now).split('-').map(Number)
  if (weeksFromDates(sport)) return m >= 8 ? y + 1 : y
  return y
}

/** "2026-27" for basketball, "2026" for football. */
export function deskSeasonLabel(sport: string, season: number): string {
  if (!weeksFromDates(sport)) return String(season)
  return `${season - 1}-${String(season).slice(-2)}`
}

/** What a game starting is called in this sport. */
export function startWord(sport: string | null | undefined): 'tip-off' | 'kickoff' {
  return weeksFromDates(sport) ? 'tip-off' : 'kickoff'
}

export function deskSportLabel(sport: string): string {
  return SPORT_LABEL[sport as Sport] ?? sport.toUpperCase()
}

export function isSport(value: string): value is Sport {
  return (SPORTS as readonly string[]).includes(value)
}

// ---- Basketball days -------------------------------------------------------
//
// A basketball board is read one night at a time, not one week: an NBA week is
// 50-odd games and a college one 250 to 470, and nobody wants Tuesday's slate
// buried under Saturday's. The derived week stays the internal key (the rail,
// desk notes and research closing all run on it), and a DAY is a filter on top
// of it, carried in the URL as ?day=YYYY-MM-DD the way ?week= is.

/**
 * When "today" turns over, in hours after midnight Eastern.
 *
 * Not midnight: a West Coast late game tips at 10:30pm ET and ends past 1am,
 * and a reader checking the score at 12:30 means last night's slate. By 4am the
 * last game anyone is following is over.
 */
export const DESK_DAY_ROLL_HOURS = 4

/** The Desk's "today" as YYYY-MM-DD, rolling over at 4am Eastern. */
export function deskToday(now: Date = new Date()): string {
  return easternDate(new Date(now.getTime() - DESK_DAY_ROLL_HOURS * 60 * 60 * 1000))
}

/** A strict YYYY-MM-DD that is also a real calendar date. */
export function isYmd(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const t = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value
}

/** YYYY-MM-DD plus n calendar days. Done in UTC so no DST hour can skip a day. */
export function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10)
}

/** The seven Eastern dates, Monday first, that make up a derived week. */
export function dateWeekDays(season: number, week: number): string[] {
  const monday = dateWeekStart(season, week).toISOString().slice(0, 10)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/**
 * The derived week a calendar date falls in. Noon UTC is mid-morning Eastern,
 * so easternDate() inside dateWeekOf reads back the same date on either side of
 * a DST change.
 */
export function dateWeekOfDay(season: number, ymd: string): number {
  return dateWeekOf(season, `${ymd}T12:00:00Z`)
}
