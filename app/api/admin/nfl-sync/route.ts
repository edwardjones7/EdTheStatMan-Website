import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildGameSlug } from '@/lib/nfl'
import { fetchWeek, fetchEventOdds, hasOdds, protectStoredOdds, ODDS_COLS, type ParsedGame } from '@/lib/espn'
import { deskSweep } from '@/lib/desk'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const admin = createAdminClient()
  const { data: p } = await (admin as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { ok: !!p?.is_admin as boolean, admin: admin as any }
}

/** Columns every deployment has. */
const BASE_COLS = [
  'season', 'season_type', 'week', 'kickoff', 'status',
  'home_team', 'home_abbrev', 'away_team', 'away_abbrev',
  'home_score', 'away_score',
] as const

/**
 * Columns added by tier_ladder_06_desk_games.sql. Written only if that
 * migration has been applied -- the route probes once and degrades to the base
 * column set otherwise, so a sync never fails just because the SQL is pending.
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

function pick(game: ParsedGame, cols: readonly string[], extra: Record<string, unknown> = {}) {
  const out: Record<string, unknown> = {}
  for (const c of cols) {
    if (c in (game as any)) out[c] = (game as any)[c]
  }
  return { ...out, ...extra }
}

export async function POST(req: Request) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any = {}
  try { body = await req.json() } catch { /* empty body = full-season sync */ }

  const sport: string = String(body.sport || 'nfl')
  const season: number = Number(body.season) || new Date().getFullYear()
  // Stage new games unpublished so a sync can be run against production before
  // the Desk is deployed, without the schedule appearing on the live site.
  // Only ever applied on INSERT -- is_published is admin-owned on existing rows.
  const publishNew: boolean = body.publish !== false

  // Default sweep: the league's own season shape, since college is 16 weeks
  // and one bowl slate where the NFL is 18 and five rounds. Empty weeks
  // (playoffs not yet scheduled) simply return no events.
  const sweep = deskSweep(sport)
  const targets: { seasonType: number; week: number }[] = []
  if (body.seasonType && body.week) {
    targets.push({ seasonType: Number(body.seasonType), week: Number(body.week) })
  } else {
    for (let w = 1; w <= sweep.regular; w++) targets.push({ seasonType: 2, week: w })
    for (let w = 1; w <= sweep.post; w++) targets.push({ seasonType: 3, week: w })
  }

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
    return NextResponse.json(
      { inserted: 0, updated: 0, failed, error: 'No games parsed from ESPN.' },
      { status: 502 }
    )
  }

  const withDesk = await hasDeskColumns(admin)
  const writeCols = withDesk ? [...BASE_COLS, ...DESK_COLS] : [...BASE_COLS]

  const { data: existingRows, error: readError } = await admin
    .from('nfl_games')
    .select(withDesk ? `espn_event_id, status, ${ODDS_COLS.join(', ')}` : 'espn_event_id, status')
    .in('espn_event_id', parsed.map(g => g.espn_event_id))
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })

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

  // A full college season is ~1,400 games, so a first run is capped rather than
  // holding the request open for all of them. The response says what is left;
  // running the sync again picks up where this stopped.
  const ODDS_FILL_CAP = 400
  const ODDS_FILL_CONCURRENCY = 8
  const fillQueue = needsOdds.slice(0, ODDS_FILL_CAP)
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
    if (error) return NextResponse.json({ error: error.message, inserted, failed }, { status: 500 })
    inserted = toInsert.length
  }

  let updated = 0
  for (const g of parsed) {
    const prior = existing.get(g.espn_event_id)
    if (!prior) continue

    const carriesOdds = hasOdds(g)
    const raw = pick(g, writeCols, withDesk && carriesOdds ? { odds_updated_at: now } : {})
    // Never let ESPN's silence after kickoff erase a price we already hold.
    const patch = withDesk ? protectStoredOdds(raw, prior) : raw

    const { error } = await admin.from('nfl_games').update(patch).eq('espn_event_id', g.espn_event_id)
    if (error) failed.push(`update ${g.espn_event_id}: ${error.message}`)
    else updated++
  }

  return NextResponse.json({
    inserted,
    updated,
    failed,
    published: publishNew,
    oddsFilled,
    oddsPending,
    source: [...sources].join(',') || 'none',
    odds: withDesk ? 'on' : 'pending tier_ladder_06_desk_games.sql',
  })
}
