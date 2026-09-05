// ESPN schedule ingestion. Free, keyless, and deliberately vendor-free.
//
// HOST CHOICE MATTERS. `site.api.espn.com` -- what this project synced from
// originally -- began returning 403 Forbidden to server-side requests. Probed
// 2026-08-31: site.api => 403, while cdn.espn.com, sports.core.api.espn.com and
// example.com all returned 200 from the same machine, so it is not a
// connectivity problem. cdn.espn.com is now primary and site.api is kept as a
// fallback in case the block is regional or temporary.
//
// The cdn host also returns MORE than site.api did: spread, moneyline and total
// each with BOTH open and close prices. Open + close is line movement, which
// was the one thing expected to force a paid odds API. It does not.
//
// ESPN's API is unofficial and unversioned. Parse defensively and skip a
// malformed event rather than failing the whole run.

export interface ParsedOdds {
  spread_open: number | null
  spread_current: number | null
  spread_favorite: string | null
  total_open: number | null
  total_current: number | null
  ml_home_open: number | null
  ml_home_current: number | null
  ml_away_open: number | null
  ml_away_current: number | null
  odds_provider: string | null
}

export interface ParsedGame extends ParsedOdds {
  espn_event_id: string
  sport: string
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
  venue_name: string | null
  venue_city: string | null
  venue_state: string | null
  venue_indoor: boolean | null
  broadcast: string | null
  home_record: string | null
  away_record: string | null
}

/** ESPN league paths, keyed by our sport values. */
const LEAGUE_PATH: Record<string, string> = {
  nfl: 'football/nfl',
  nflpre: 'football/nfl',
  cfb: 'football/college-football',
  nba: 'basketball/nba',
  wnba: 'basketball/wnba',
  cbb: 'basketball/mens-college-basketball',
}

const CDN = 'https://cdn.espn.com/core'
const SITE_API = 'https://site.api.espn.com/apis/site/v2/sports'

/** "-3.5" / "+3.5" / "o44.5" / "u44.5" -> number, or null. */
function num(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const cleaned = String(value).replace(/^[ou]/i, '').replace(/^\+/, '')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function int(value: unknown): number | null {
  const n = num(value)
  return n === null ? null : Math.round(n)
}

/**
 * Odds off a competition, tolerant of both shapes: site.api returns
 * `odds` as an array, cdn returns it as a single object.
 */
export function parseOdds(comp: any, homeAbbrev: string, awayAbbrev: string): ParsedOdds {
  const empty: ParsedOdds = {
    spread_open: null, spread_current: null, spread_favorite: null,
    total_open: null, total_current: null,
    ml_home_open: null, ml_home_current: null,
    ml_away_open: null, ml_away_current: null,
    odds_provider: null,
  }

  const raw = comp?.odds
  const o = Array.isArray(raw) ? raw[0] : raw
  if (!o) return empty

  // Spreads are stored home-relative so a single number is comparable across
  // games: negative means the home side is laying points.
  const ps = o.pointSpread
  const spreadOpen = num(ps?.home?.open?.line)
  const spreadCurrent = num(ps?.home?.close?.line) ?? num(o.spread)

  const favorite = o.homeTeamOdds?.favorite
    ? homeAbbrev
    : o.awayTeamOdds?.favorite
      ? awayAbbrev
      : null

  const ml = o.moneyline

  return {
    spread_open: spreadOpen,
    spread_current: spreadCurrent,
    spread_favorite: favorite,
    total_open: num(o.total?.over?.open?.line),
    total_current: num(o.total?.over?.close?.line) ?? num(o.overUnder),
    ml_home_open: int(ml?.home?.open?.odds),
    ml_home_current: int(ml?.home?.close?.odds),
    ml_away_open: int(ml?.away?.open?.odds),
    ml_away_current: int(ml?.away?.close?.odds),
    odds_provider: o.provider?.displayName ?? null,
  }
}

/** One competition -> ParsedGame. Returns null for anything malformed. */
function parseEvent(
  event: any,
  sport: string,
  season: number,
  seasonType: number,
  week: number
): ParsedGame | null {
  const comp = event?.competitions?.[0]
  const competitors = comp?.competitors ?? []
  const home = competitors.find((c: any) => c.homeAway === 'home')
  const away = competitors.find((c: any) => c.homeAway === 'away')
  if (!event?.id || !home?.team?.abbreviation || !away?.team?.abbreviation) return null

  const scoreOf = (c: any) => {
    const n = Number(c?.score?.value ?? c?.score)
    return c?.score !== undefined && c?.score !== '' && Number.isFinite(n) ? n : null
  }
  const recordOf = (c: any) =>
    (c?.records ?? []).find((r: any) => r.type === 'total')?.summary ?? null

  const homeAbbrev = String(home.team.abbreviation)
  const awayAbbrev = String(away.team.abbreviation)

  // ESPN publishes playoff slots months ahead as 'TBD at TBD' placeholders.
  // They are not games yet, they all slug to the same string, and slugs are
  // frozen at insert -- storing one would brand a real matchup tbd-at-tbd
  // forever. Skip until the bracket resolves; the event syncs in later.
  if (homeAbbrev === 'TBD' || awayAbbrev === 'TBD') return null

  const broadcastNames: string[] =
    comp?.broadcasts?.[0]?.names ??
    (comp?.broadcast ? [comp.broadcast] : [])

  return {
    espn_event_id: String(event.id),
    sport,
    season,
    season_type: seasonType,
    week: Number(event?.week?.number ?? week),
    kickoff: event?.date ? new Date(event.date).toISOString() : null,
    status: String(event?.status?.type?.state ?? comp?.status?.type?.state ?? 'pre'),
    home_team: String(home.team.displayName ?? homeAbbrev),
    home_abbrev: homeAbbrev,
    away_team: String(away.team.displayName ?? awayAbbrev),
    away_abbrev: awayAbbrev,
    home_score: scoreOf(home),
    away_score: scoreOf(away),
    venue_name: comp?.venue?.fullName ?? null,
    venue_city: comp?.venue?.address?.city ?? null,
    venue_state: comp?.venue?.address?.state ?? null,
    venue_indoor: typeof comp?.venue?.indoor === 'boolean' ? comp.venue.indoor : null,
    broadcast: Array.isArray(broadcastNames) && broadcastNames.length
      ? broadcastNames.join(', ')
      : null,
    home_record: recordOf(home),
    away_record: recordOf(away),
    ...parseOdds(comp, homeAbbrev, awayAbbrev),
  }
}

/** cdn.espn.com groups events by yyyymmdd under content.schedule. */
function eventsFromCdn(json: any): any[] {
  const schedule = json?.content?.schedule
  if (!schedule || typeof schedule !== 'object') return []
  const out: any[] = []
  for (const day of Object.values<any>(schedule)) {
    for (const game of day?.games ?? []) out.push(game)
  }
  return out
}

/** site.api.espn.com returns a flat events array. */
function eventsFromSiteApi(json: any): any[] {
  return json?.events ?? []
}

/** Opening lines are captured once and never moved -- that IS the movement. */
export const OPEN_COLS = ['spread_open', 'total_open', 'ml_home_open', 'ml_away_open'] as const

/** Every column carrying a price. */
export const ODDS_COLS = [
  ...OPEN_COLS,
  'spread_current', 'spread_favorite',
  'total_current', 'ml_home_current', 'ml_away_current',
  'odds_provider',
] as const

/** True when ESPN actually sent a price for this game. */
export function hasOdds(game: Partial<ParsedOdds>): boolean {
  return ODDS_COLS.some(c => (game as any)[c] !== null && (game as any)[c] !== undefined)
}

/**
 * Strip from an update patch any odds column that must not be written, given
 * what the row already holds. Two rules, both about never losing a price:
 *
 *   1. An opening line is frozen once captured. Overwriting it each sync would
 *      erase the movement, which is the entire point of storing both numbers.
 *
 *   2. No stored line is ever overwritten with nothing. ESPN drops the whole
 *      `odds` object the moment a game leaves `pre` -- verified 2026-09-05
 *      across live and completed slates in both leagues: 0 of 57 in-progress or
 *      final college games carried a price, and 0 of 14 final NFL games. The
 *      last number seen before kickoff IS the closing line, the one every ATS
 *      result is computed from, so writing that absence back would destroy it
 *      permanently on the first sync after kickoff -- on exactly the games
 *      people are watching. An absent price is missing data, not a price.
 *
 * Returns a new patch; the input is not modified.
 */
export function protectStoredOdds(
  patch: Record<string, unknown>,
  prior: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...patch }
  for (const col of ODDS_COLS) {
    const stored = prior[col] !== null && prior[col] !== undefined
    if (!stored) continue
    const frozen = (OPEN_COLS as readonly string[]).includes(col)
    const erasing = out[col] === null || out[col] === undefined
    if (frozen || erasing) delete out[col]
  }
  return out
}

const CORE = 'https://sports.core.api.espn.com/v2/sports'

/**
 * Opening and closing prices for ONE event, from the per-event core API.
 *
 * This exists because the schedule feed stops carrying prices. `cdn.espn.com`
 * returns the full odds block for a game in `pre` and drops it entirely the
 * moment the game kicks off -- verified 2026-09-05: of 57 in-progress or final
 * college games and 14 final NFL games, not one carried a price. The schedule
 * is therefore useless for the closing line, which is the number every ATS
 * result is computed from.
 *
 * The prices are still published, per event rather than per week, which is why
 * this is one request per game and not part of the week sweep. Confirmed to
 * carry spread, total AND both moneylines for a completed NFL game and for a
 * college game that was in progress at the time.
 *
 * Provider choice is not `items[0]`: the "Live Odds" provider on the same
 * payload carries open and current but NO close, so taking the first item
 * silently loses the closing number on some games. Prefer whoever actually has
 * a close block. Same rule the history backfill script arrived at.
 */
export async function fetchEventOdds(
  sport: string,
  eventId: string,
  homeAbbrev: string,
  awayAbbrev: string
): Promise<ParsedOdds | null> {
  // The core API nests the league one level deeper than the other two hosts:
  // /sports/football/leagues/nfl, where LEAGUE_PATH holds "football/nfl".
  const [group, leagueSlug] = (LEAGUE_PATH[sport] ?? LEAGUE_PATH.nfl).split('/')
  const url = `${CORE}/${group}/leagues/${leagueSlug}/events/${eventId}/competitions/${eventId}/odds`
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; EdTheStatMan/1.0)', Accept: 'application/json' }

  let items: any[] = []
  try {
    const res = await fetch(url, { cache: 'no-store', headers })
    if (!res.ok) return null
    const json = await res.json()
    items = json?.items ?? []
  } catch {
    return null
  }
  if (items.length === 0) return null

  const it = items.find((x: any) => x?.homeTeamOdds?.close?.pointSpread) ?? items[0]
  const home = it?.homeTeamOdds ?? {}
  const away = it?.awayTeamOdds ?? {}

  const spreadOpen = num(home?.open?.pointSpread?.alternateDisplayValue)
  const spreadCurrent = num(home?.close?.pointSpread?.alternateDisplayValue)

  // Home-relative, same convention as the schedule feed: negative means the
  // home side is laying the points.
  const favSource = spreadCurrent ?? spreadOpen
  const favorite = favSource === null || favSource === 0
    ? null
    : favSource < 0 ? homeAbbrev : awayAbbrev

  const odds: ParsedOdds = {
    spread_open: spreadOpen,
    spread_current: spreadCurrent,
    spread_favorite: favorite,
    total_open: num(it?.open?.total?.alternateDisplayValue),
    total_current: num(it?.close?.total?.alternateDisplayValue),
    ml_home_open: int(home?.open?.moneyLine?.alternateDisplayValue),
    ml_home_current: int(home?.close?.moneyLine?.alternateDisplayValue),
    ml_away_open: int(away?.open?.moneyLine?.alternateDisplayValue),
    ml_away_current: int(away?.close?.moneyLine?.alternateDisplayValue),
    odds_provider: it?.provider?.name ?? null,
  }
  return hasOdds(odds) ? odds : null
}

export interface WeekResult {
  games: ParsedGame[]
  source: 'cdn' | 'site-api' | 'none'
  error?: string
}

/**
 * One week of a season. Tries cdn first, then site.api. A week with no games
 * (playoffs not yet scheduled) is a success with an empty list, not an error.
 */
export async function fetchWeek(
  sport: string,
  season: number,
  seasonType: number,
  week: number
): Promise<WeekResult> {
  const league = LEAGUE_PATH[sport] ?? LEAGUE_PATH.nfl
  const leagueSlug = league.split('/')[1]
  // A browser-ish UA: ESPN rejects some default server agents outright.
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; EdTheStatMan/1.0)', Accept: 'application/json' }

  const attempts: { url: string; source: 'cdn' | 'site-api'; extract: (j: any) => any[] }[] = [
    {
      url: `${CDN}/${leagueSlug}/schedule?xhr=1&year=${season}&seasontype=${seasonType}&week=${week}`,
      source: 'cdn',
      extract: eventsFromCdn,
    },
    {
      url: `${SITE_API}/${league}/scoreboard?dates=${season}&seasontype=${seasonType}&week=${week}`,
      source: 'site-api',
      extract: eventsFromSiteApi,
    },
  ]

  let lastError = ''
  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, { cache: 'no-store', headers })
      if (!res.ok) { lastError = `${attempt.source}: HTTP ${res.status}`; continue }
      const json = await res.json()
      const events = attempt.extract(json)
      const games: ParsedGame[] = []
      for (const event of events) {
        const parsed = parseEvent(event, sport, season, seasonType, week)
        if (parsed) games.push(parsed)
      }
      return { games, source: attempt.source }
    } catch (e: any) {
      lastError = `${attempt.source}: ${e?.message ?? 'error'}`
    }
  }

  return { games: [], source: 'none', error: lastError }
}
