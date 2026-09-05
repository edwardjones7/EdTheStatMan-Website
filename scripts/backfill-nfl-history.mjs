// Backfill completed NFL seasons into nfl_games, WITH opening and closing odds.
//
//   node --env-file=.env.local scripts/backfill-nfl-history.mjs                 # dry run
//   node --env-file=.env.local scripts/backfill-nfl-history.mjs --write         # writes
//   node --env-file=.env.local scripts/backfill-nfl-history.mjs --seasons 2025  # one season
//
// WHY THIS EXISTS, and why it is not just a call to /api/admin/nfl-sync.
//
// The Vault's rules are overwhelmingly situational -- 46% of active systems say
// "off a loss", 37% say something about days of rest. None of that is checkable
// against a table holding one season, because in week 1 no team has a previous
// game in it. Backfilling completed seasons is the prerequisite for every
// history facet the matcher will need.
//
// The existing sync cannot do it. Probed 2026-09-04: cdn.espn.com returns the
// schedule and final scores for 2024 and 2025 perfectly, but ZERO odds -- the
// competition's `odds` array is empty for completed seasons. Without a closing
// line there is no ATS result, and "off an ATS loss" is 42% of the rules.
//
// The odds are still there, on a different host and per event rather than per
// week: sports.core.api.espn.com/.../events/{id}/competitions/{id}/odds carries
// `homeTeamOdds.open.pointSpread` and `homeTeamOdds.close.pointSpread`, plus
// `close.total`. Verified 24/24 across 2025 wk1, 2025 wk12 and 2024 wk5.
//
// Note what is NOT usable, because it looks like it should be: the `spreadWinner`
// and `moneylineWinner` booleans on that payload read `false` on every completed
// game probed. ESPN is not handing us the ATS result; it is computed here from
// the closing spread and the final score.
//
// SAFETY
//   - Dry run by default. Nothing is written without --write.
//   - Rows are inserted with is_published = false. Every Desk read filters on
//     is_published, so backfilled seasons cannot surface anywhere on the site.
//   - espn_event_id is UNIQUE and this only ever inserts rows that are absent,
//     so re-running is a no-op rather than a duplicate.
//   - Existing rows are never updated. A completed season does not change, and
//     not touching them means this can never overwrite a 2026 row by accident.

import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const seasonArg = args.indexOf('--seasons')
const SEASONS = seasonArg !== -1 && args[seasonArg + 1]
  ? args[seasonArg + 1].split(',').map(Number)
  : [2024, 2025]

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; EdTheStatMan/1.0)',
  Accept: 'application/json',
}
const CDN = 'https://cdn.espn.com/core/nfl/schedule'
const CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/events'

/** Regular season weeks 1-18, postseason 1-5. Same sweep the admin sync uses. */
const WEEKS = [
  ...Array.from({ length: 18 }, (_, i) => ({ seasonType: 2, week: i + 1 })),
  ...Array.from({ length: 5 }, (_, i) => ({ seasonType: 3, week: i + 1 })),
]

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** ESPN mixes numbers and strings like "-7.5" / "EVEN". Null when unusable. */
function num(v) {
  if (v === null || v === undefined) return null
  const n = parseFloat(String(v).replace(/[^0-9.+-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function buildGameSlug(season, seasonType, week, away, home) {
  const stage = seasonType === 3 ? `post${week}` : `wk${week}`
  return `${season}-${stage}-${away}-at-${home}`.toLowerCase()
}

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: HEADERS })
      if (r.ok) return await r.json()
      // 404 is a real answer for a week that does not exist; do not retry it.
      if (r.status === 404) return null
    } catch {
      /* fall through to the backoff */
    }
    await sleep(400 * (i + 1))
  }
  return null
}

/** cdn.espn.com groups events by yyyymmdd under content.schedule. */
function eventsFromCdn(json) {
  const days = json?.content?.schedule ?? {}
  const out = []
  for (const key of Object.keys(days)) out.push(...(days[key]?.games ?? []))
  return out
}

/**
 * Opening and closing spread/total for one completed event.
 *
 * Prefers the provider that actually carries a `close` block -- the "Live Odds"
 * provider on the same payload has `open` and `current` but no close, and
 * silently taking items[0] would lose the closing number on some games.
 */
async function oddsFor(eventId) {
  const d = await getJson(`${CORE}/${eventId}/competitions/${eventId}/odds`)
  const items = d?.items ?? []
  if (items.length === 0) return null

  const it = items.find(x => x?.homeTeamOdds?.close?.pointSpread) ?? items[0]
  const home = it?.homeTeamOdds ?? {}

  return {
    spread_open: num(home?.open?.pointSpread?.alternateDisplayValue),
    spread_current: num(home?.close?.pointSpread?.alternateDisplayValue),
    total_open: num(it?.open?.total?.alternateDisplayValue),
    total_current: num(it?.close?.total?.alternateDisplayValue),
    ml_home_open: num(home?.open?.moneyLine?.alternateDisplayValue),
    ml_away_open: num(it?.awayTeamOdds?.open?.moneyLine?.alternateDisplayValue),
    odds_provider: it?.provider?.name ?? null,
  }
}

function parseEvent(ev, season, seasonType, week) {
  const comp = ev?.competitions?.[0]
  const competitors = comp?.competitors ?? []
  const home = competitors.find(c => c.homeAway === 'home')
  const away = competitors.find(c => c.homeAway === 'away')
  if (!ev?.id || !home?.team?.abbreviation || !away?.team?.abbreviation) return null

  const homeAbbrev = String(home.team.abbreviation)
  const awayAbbrev = String(away.team.abbreviation)
  // Same rule as lib/espn.ts: unresolved bracket slots all slug identically and
  // slugs are frozen at insert, so storing one would brand a real matchup.
  if (homeAbbrev === 'TBD' || awayAbbrev === 'TBD') return null

  return {
    espn_event_id: String(ev.id),
    sport: 'nfl',
    season,
    season_type: seasonType,
    week,
    kickoff: ev.date ?? comp?.date ?? null,
    status: comp?.status?.type?.state ?? 'post',
    home_team: String(home.team.displayName ?? homeAbbrev),
    home_abbrev: homeAbbrev,
    away_team: String(away.team.displayName ?? awayAbbrev),
    away_abbrev: awayAbbrev,
    home_score: num(home.score),
    away_score: num(away.score),
    slug: buildGameSlug(season, seasonType, week, awayAbbrev, homeAbbrev),
    is_published: false,
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }
  const db = createClient(url, key)

  console.log(WRITE ? '*** WRITE MODE ***' : '--- DRY RUN (no writes; pass --write to commit) ---')
  console.log('seasons:', SEASONS.join(', '), '\n')

  const { data: existingRows, error: exErr } = await db
    .from('nfl_games')
    .select('espn_event_id')
  if (exErr) {
    console.error('Could not read nfl_games:', exErr.message)
    process.exit(1)
  }
  const existing = new Set((existingRows ?? []).map(r => r.espn_event_id))
  console.log(`nfl_games currently holds ${existing.size} rows\n`)

  let totalNew = 0, totalSkip = 0, totalOdds = 0, totalAts = 0
  const failed = []

  for (const season of SEASONS) {
    let seasonNew = 0, seasonOdds = 0, seasonAts = 0
    process.stdout.write(`${season}: `)

    for (const { seasonType, week } of WEEKS) {
      const json = await getJson(`${CDN}?xhr=1&year=${season}&seasontype=${seasonType}&week=${week}`)
      const events = json ? eventsFromCdn(json) : []
      if (events.length === 0) { process.stdout.write('.'); continue }

      const rows = []
      for (const ev of events) {
        const row = parseEvent(ev, season, seasonType, week)
        if (!row) continue
        if (existing.has(row.espn_event_id)) { totalSkip++; continue }

        const o = await oddsFor(row.espn_event_id)
        if (o) {
          Object.assign(row, o, { odds_updated_at: new Date().toISOString() })
          if (o.spread_current !== null) {
            seasonOdds++
            // The whole point of the closing line: it makes the ATS result of a
            // completed game computable, which is what "off an ATS loss" needs.
            if (row.home_score !== null && row.away_score !== null) seasonAts++
          }
        }
        // Be a good citizen; this is an undocumented public endpoint.
        await sleep(90)
        rows.push(row)
      }

      if (rows.length === 0) { process.stdout.write('.'); continue }
      seasonNew += rows.length

      if (WRITE) {
        const { error } = await db.from('nfl_games').insert(rows)
        if (error) {
          failed.push(`${season} st${seasonType} wk${week}: ${error.message}`)
          process.stdout.write('!')
          continue
        }
        for (const r of rows) existing.add(r.espn_event_id)
      }
      process.stdout.write('#')
    }

    console.log(`\n  ${season}: ${seasonNew} new rows, ${seasonOdds} with a closing spread, ${seasonAts} ATS-gradeable`)
    totalNew += seasonNew; totalOdds += seasonOdds; totalAts += seasonAts
  }

  console.log('\n' + '='.repeat(58))
  console.log(WRITE ? 'WROTE' : 'WOULD WRITE', `${totalNew} rows (is_published = false)`)
  console.log(`already present, skipped : ${totalSkip}`)
  console.log(`with a closing spread    : ${totalOdds}`)
  console.log(`ATS-gradeable            : ${totalAts}`)
  if (failed.length) {
    console.log(`\nfailures (${failed.length}):`)
    failed.slice(0, 20).forEach(f => console.log('  ' + f))
  }
  if (!WRITE) console.log('\nNothing was written. Re-run with --write to commit.')
}

main().catch(e => { console.error(e); process.exit(1) })
