import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTargets } from '@/lib/desk-sync'
import { currentWeekOf } from '@/lib/nfl'
import { DESK_SPORTS } from '@/lib/desk'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Keep the week that is on screen current, while somebody is looking at it.
 *
 * WHY THIS EXISTS. The board already lands on the current week and already
 * leads each day with whatever is live -- currentWeekOf() and groupSlate() in
 * lib/nfl.ts. Both read `status`, and `status` only ever changed when an admin
 * pressed Sync. So the board was live-aware over data that was frozen: every
 * NFL row sat at `pre` for 35 hours while the season ran.
 *
 * WHY NOT ONLY A CRON. Vercel's Hobby plan caps cron jobs at once a day, which
 * cannot make anything live, and the schedule shape should not depend on which
 * plan the project happens to be on. Traffic is the better clock anyway: the
 * board needs to be fresh exactly when somebody has it open, which is exactly
 * when this fires. The cron (app/api/cron/desk-sync) covers the other case --
 * keeping the schedule current when nobody is there.
 *
 * OPEN BY DESIGN, BUT NOT ABUSABLE:
 *
 *   - The week is computed HERE, from the database, and the request body is
 *     never trusted for it. There is no way to ask this endpoint to sweep a
 *     season; it will only ever touch the one week the board is showing.
 *   - MIN_INTERVAL_MS makes a repeat call a no-op that touches neither ESPN nor
 *     the database. Hammering it costs one cheap SELECT.
 *   - It writes only what ESPN says. Nothing in the request reaches a column.
 */

/**
 * How stale the week has to be before a caller actually triggers a sync.
 *
 * 45s rather than the 60s the board polls at, so a client on a 60s timer is
 * never turned away by its own cadence -- with the two equal, ordinary jitter
 * means every other poll no-ops and the real interval becomes two minutes.
 */
const MIN_INTERVAL_MS = 45_000

/**
 * Cheap protection against a stampede within one instance: several viewers
 * landing together would otherwise each see the same stale timestamp and each
 * start a sync. Not shared between instances -- the sync is idempotent, so the
 * worst case there is duplicated work, not damage.
 */
const inFlight = new Map<string, Promise<unknown>>()

/**
 * When this week was last ATTEMPTED, as opposed to last written.
 *
 * The two came apart once syncTargets() started skipping rows nothing had moved
 * on. The gate below derives its age from the newest updated_at in the week,
 * which is exact and needs no column -- but a run that finds all 99 games
 * identical writes nothing, so updated_at does not advance and the very next
 * caller reads the week as stale again. During a quiet window that turned the
 * gate off entirely: every page load would fetch ESPN afresh.
 *
 * Per instance, not shared, which is the right scope anyway: it exists to stop
 * one warm instance being hammered, and that is exactly the case a local map
 * covers. Anything it misses falls through to the database check below.
 */
const lastAttempt = new Map<string, number>()

export async function POST(req: Request) {
  let body: any = {}
  try { body = await req.json() } catch { /* sport in the query string is fine too */ }

  const url = new URL(req.url)
  const sport = String(body.sport || url.searchParams.get('sport') || '').toLowerCase()
  if (!DESK_SPORTS.includes(sport as any)) {
    return NextResponse.json({ error: 'Unknown sport.' }, { status: 400 })
  }

  const admin = createAdminClient() as any

  // The season a visitor is actually looking at: the newest one with published
  // rows. Same rule as the board (app/desk/[sport]/page.tsx).
  const { data: seasonRow } = await admin
    .from('nfl_games')
    .select('season')
    .eq('sport', sport)
    .eq('is_published', true)
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle()

  const season: number = seasonRow?.season ?? new Date().getFullYear()

  const { data: weekRows } = await admin
    .from('nfl_games')
    .select('season_type, week, kickoff, status, updated_at')
    .eq('sport', sport)
    .eq('season', season)
    .eq('is_published', true)

  const rows = weekRows ?? []
  const active = currentWeekOf(rows, new Date())
  if (!active) {
    return NextResponse.json({ synced: false, reason: 'no games' })
  }

  // Last WRITE to this week, derived rather than stored: the newest updated_at
  // in the week is the last time anything about it actually changed. Saves a
  // column and a migration, and cannot drift out of step with the thing it
  // describes. It is only half the answer -- see lastAttempt above for the runs
  // that correctly wrote nothing.
  const inWeek = rows.filter(
    (r: any) => r.season_type === active.season_type && r.week === active.week
  )
  const lastSync = inWeek.reduce((newest: number, r: any) => {
    const t = r.updated_at ? new Date(r.updated_at).getTime() : 0
    return t > newest ? t : newest
  }, 0)
  const key = `${sport}-${season}-${active.season_type}-${active.week}`

  // Whichever is more recent: a write we can see in the data, or an attempt this
  // instance made that turned out to be a no-op.
  const attempted = lastAttempt.get(key) ?? 0
  const since = Math.max(lastSync, attempted)
  const ageMs = Date.now() - since

  if (since > 0 && ageMs < MIN_INTERVAL_MS) {
    return NextResponse.json({
      synced: false,
      reason: 'fresh',
      ageMs,
      season,
      week: active,
    })
  }

  if (inFlight.has(key)) {
    return NextResponse.json({ synced: false, reason: 'in flight', season, week: active })
  }

  // One week, so the odds backfill is small by construction. Capped anyway: a
  // college Saturday is ~90 games and this runs on a viewer's request, not a
  // background job, so it must not sit there making 90 sequential-ish calls.
  const work = syncTargets(admin, {
    sport,
    season,
    targets: [{ seasonType: active.season_type, week: active.week }],
    // A game appearing mid-week is a real game; staging it invisibly would mean
    // the board silently disagrees with the schedule. Admin-owned columns on
    // existing rows are untouched either way.
    publishNew: true,
    oddsFillCap: 40,
  })
  inFlight.set(key, work)
  lastAttempt.set(key, Date.now())

  try {
    const result = await work
    const { httpStatus, ...payload } = result
    return NextResponse.json(
      { synced: true, season, week: active, ageMs, ...payload },
      { status: httpStatus }
    )
  } catch (e: any) {
    return NextResponse.json({ synced: false, error: e?.message ?? 'sync failed' }, { status: 500 })
  } finally {
    inFlight.delete(key)
  }
}
