import { buildGameSlug } from './nfl'
import { fetchWeek, fetchEventOdds, hasOdds, protectStoredOdds, ODDS_COLS, type ParsedGame } from './espn'

/**
 * One ESPN sync, for any set of weeks.
 *
 * Extracted from app/api/admin/nfl-sync so the admin button, the board's own
 * refresh and the cron all run the SAME code. They differ only in which weeks
 * they ask for: the button sweeps a season, the board asks for the week it is
 * showing, the cron asks for this week and next. Three copies of this would be
 * three places for the odds-protection rule to drift out of agreement, and that
 * rule is what stops a kicked-off game losing its closing line.
 */

/** Columns every deployment has. */
const BASE_COLS = [
  'season', 'season_type', 'week', 'kickoff', 'status',
  'home_team', 'home_abbrev', 'away_team', 'away_abbrev',
  'home_score', 'away_score',
] as const

/**
 * Columns added by tier_ladder_06_desk_games.sql. Written only if that
 * migration has been applied -- the sync probes once and degrades to the base
 * column set otherwise, so it never fails just because the SQL is pending.
 */
const DESK_COLS = [
  'sport',
  'spread_open', 'spread_current', 'spread_favorite',
  'total_open', 'total_current',
  'ml_home_open', 'ml_home_current', 'ml_away_open', 'ml_away_current',
  'odds_provider', 'odds_updated_at',
  'venue_name', 'venue_city', 'venue_state', 'venue_indoor',
  'broadcast', 'home_record', 'away_record',
] as const

async function hasDeskColumns(admin: any): Promise<boolean> {
  const { error } = await admin.from('nfl_games').select('spread_open').limit(1)
  return !error
}

/**
 * Is this column unchanged?
 *
 * Not `===`, for two reasons that both cost real writes:
 *
 *   - null and undefined are the same absence, spelled differently by Postgres
 *     and by the parser.
 *   - TIMESTAMPS ARE THE SAME INSTANT IN TWO NOTATIONS. lib/espn.ts writes
 *     `new Date(event.date).toISOString()`, which is "2026-08-29T19:00:00.000Z";
 *     PostgREST hands the same moment back as "2026-08-29T19:00:00+00:00".
 *     Compared as text those never match, so `kickoff` looked changed on every
 *     row of every week and the skip below saved nothing at all -- 99 games in,
 *     99 games written.
 */
function sameValue(before: unknown, after: unknown): boolean {
  if (before == null && after == null) return true
  if (before === after) return true
  if (typeof before === 'string' && typeof after === 'string' && before.includes('T')) {
    const a = Date.parse(before)
    const b = Date.parse(after)
    if (!Number.isNaN(a) && !Number.isNaN(b)) return a === b
  }
  return false
}

function pick(game: ParsedGame, cols: readonly string[], extra: Record<string, unknown> = {}) {
  const out: Record<string, unknown> = {}
  for (const c of cols) {
    if (c in (game as any)) out[c] = (game as any)[c]
  }
  return { ...out, ...extra }
}

export interface SyncTarget {
  seasonType: number
  week: number
}

export interface SyncResult {
  inserted: number
  updated: number
  /** Rows ESPN returned that were already identical, so were not written. */
  unchanged?: number
  failed: string[]
  published?: boolean
  oddsFilled?: number
  oddsPending?: number
  source?: string
  odds?: string
  error?: string
  /** HTTP status the caller should answer with. */
  httpStatus: number
}

export interface SyncOptions {
  sport: string
  season: number
  targets: SyncTarget[]
  /** Stage new rows unpublished. Only ever applied on INSERT. */
  publishNew: boolean
  /**
   * Per-event odds requests this run may make. A full college season is ~1,400
   * games, so a first sweep is capped rather than holding the request open for
   * all of them; the result says what is left. The board's own refresh passes a
   * small number because it is one week and must stay quick.
   */
  oddsFillCap?: number
}

export async function syncTargets(admin: any, opts: SyncOptions): Promise<SyncResult> {
  const { sport, season, targets, publishNew, oddsFillCap = 400 } = opts

  const parsed: ParsedGame[] = []
  const failed: string[] = []
  const sources = new Set<string>()

  for (const t of targets) {
    const result = await fetchWeek(sport, season, t.seasonType, t.week)
    if (result.error) failed.push(`${t.seasonType}/${t.week}: ${result.error}`)
    if (result.source !== 'none') sources.add(result.source)
    parsed.push(...result.games)
  }

  if (parsed.length === 0) {
    return { inserted: 0, updated: 0, failed, error: 'No games parsed from ESPN.', httpStatus: 502 }
  }

  const withDesk = await hasDeskColumns(admin)
  const writeCols = withDesk ? [...BASE_COLS, ...DESK_COLS] : [...BASE_COLS]

  // Every column the sync can write, not just the odds ones, so the update loop
  // below can tell a row that changed from a row that did not. Named explicitly
  // rather than `*`: writeup_html is on this table and can be thousands of words
  // per row, and reading a college Saturday's worth of them to compare a score
  // would cost more than the writes this saves.
  const readCols = ['espn_event_id', 'status', ...writeCols, ...ODDS_COLS]
  const { data: existingRows, error: readError } = await admin
    .from('nfl_games')
    .select([...new Set(readCols)].join(', '))
    .in('espn_event_id', parsed.map(g => g.espn_event_id))
  if (readError) {
    return { inserted: 0, updated: 0, failed, error: readError.message, httpStatus: 500 }
  }

  const existing = new Map<string, any>(
    (existingRows ?? []).map((r: any) => [r.espn_event_id, r])
  )

  // ---- Fill in prices the schedule feed will not give us -------------------
  // The week sweep returns no odds at all for a game that has kicked off, so
  // without this a live or finished game shows no line and its close is never
  // captured. Those prices are still published per event, one request each,
  // which is why this is a targeted second pass rather than part of the sweep.
  //
  // Two cases need a price fetched, and the second is easy to miss. A game we
  // hold no current line for, obviously. But also a game that has just kicked
  // off for the first time: what we stored is whatever the line was at the last
  // sync before kickoff, which is an approximation of the close. This is the one
  // moment the real one can be read, so take it. `prior.status` being `pre`
  // while ESPN now says otherwise is exactly "this is the first sync since it
  // started", so each game is fetched once and no more.
  //
  // Games that have left `pre` go first, because for them the closing line is
  // otherwise gone for good, where an unpriced upcoming game just gets its
  // price on a later sync.
  const needsOdds = parsed
    .filter(g => {
      if (!withDesk || hasOdds(g)) return false
      const prior = existing.get(g.espn_event_id)
      if (!prior) return true
      const noLine = prior.spread_current === null || prior.spread_current === undefined
      const justStarted = g.status !== 'pre' && prior.status === 'pre'
      return noLine || justStarted
    })
    .sort((a, b) => Number(a.status === 'pre') - Number(b.status === 'pre'))

  const ODDS_FILL_CONCURRENCY = 8
  const fillQueue = needsOdds.slice(0, oddsFillCap)
  const oddsPending = needsOdds.length - fillQueue.length

  let oddsFilled = 0
  if (fillQueue.length > 0) {
    const queue = [...fillQueue]
    await Promise.all(
      Array.from({ length: Math.min(ODDS_FILL_CONCURRENCY, queue.length) }, async () => {
        for (let g = queue.shift(); g; g = queue.shift()) {
          const odds = await fetchEventOdds(sport, g.espn_event_id, g.home_abbrev, g.away_abbrev)
          if (!odds) continue
          Object.assign(g, odds)
          oddsFilled++
        }
      })
    )
  }

  const now = new Date().toISOString()

  // Split insert vs update so admin-owned columns (slug, brief, writeup_html,
  // is_published, curated links) are never touched by a sync. Slugs are frozen
  // at insert for SEO stability even if ESPN later changes an abbreviation.
  const seenIds = new Set<string>()
  const seenSlugs = new Set<string>()
  const toInsert = parsed
    .filter(g => !existing.has(g.espn_event_id))
    .map(g => pick(g, writeCols, {
      espn_event_id: g.espn_event_id,
      slug: buildGameSlug(g.sport, g.season, g.season_type, g.week, g.away_abbrev, g.home_abbrev),
      is_published: publishNew,
      ...(withDesk ? { odds_updated_at: now } : {}),
    }))
    .filter((row: any) => {
      // espn_event_id and slug are both UNIQUE and this is one batch insert --
      // a single collision rejects every other row with it. Drop the duplicate
      // and report it rather than losing the whole sync.
      if (seenIds.has(row.espn_event_id) || seenSlugs.has(row.slug)) {
        failed.push(`duplicate slug ${row.slug} (${row.espn_event_id})`)
        return false
      }
      seenIds.add(row.espn_event_id)
      seenSlugs.add(row.slug)
      return true
    })

  let inserted = 0
  if (toInsert.length > 0) {
    const { error } = await admin.from('nfl_games').insert(toInsert)
    if (error) return { inserted, updated: 0, failed, error: error.message, httpStatus: 500 }
    inserted = toInsert.length
  }

  let updated = 0
  let unchanged = 0
  for (const g of parsed) {
    const prior = existing.get(g.espn_event_id)
    if (!prior) continue

    const carriesOdds = hasOdds(g)
    const raw = pick(g, writeCols, withDesk && carriesOdds ? { odds_updated_at: now } : {})
    // Never let ESPN's silence after kickoff erase a price we already hold.
    const patch = withDesk ? protectStoredOdds(raw, prior) : raw

    // Skip rows nothing moved on. These updates are one round trip each, in
    // series, and this now runs on a viewer's request rather than an admin's
    // button: a college Saturday is ~99 games of which nearly all are finished
    // and identical from one minute to the next, and writing all 99 anyway took
    // 12.9s measured. Comparing first turns that into the handful that actually
    // changed.
    //
    // odds_updated_at is excluded from the comparison on purpose -- it is set to
    // `now` on every run that carries odds, so including it would make every row
    // look changed and defeat the whole check.
    const movedKeys = Object.keys(patch).filter(k => {
      if (k === 'odds_updated_at') return false
      return !sameValue((prior as any)[k], (patch as any)[k])
    })
    if (movedKeys.length === 0) {
      unchanged++
      continue
    }

    const { error } = await admin.from('nfl_games').update(patch).eq('espn_event_id', g.espn_event_id)
    if (error) failed.push(`update ${g.espn_event_id}: ${error.message}`)
    else updated++
  }

  return {
    inserted,
    updated,
    unchanged,
    failed,
    published: publishNew,
    oddsFilled,
    oddsPending,
    source: [...sources].join(',') || 'none',
    odds: withDesk ? 'on' : 'pending tier_ladder_06_desk_games.sql',
    httpStatus: 200,
  }
}
