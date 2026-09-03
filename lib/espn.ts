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
