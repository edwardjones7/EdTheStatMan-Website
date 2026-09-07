import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTargets } from '@/lib/desk-sync'
import { currentWeekOf } from '@/lib/nfl'
import { DESK_SPORTS, deskSweep } from '@/lib/desk'

export const dynamic = 'force-dynamic'
// Two sports, two weeks each, plus the odds backfill on anything new.
export const maxDuration = 300

/**
 * Scheduled sweep of the current and next week, for every Desk sport.
 *
 * THIS IS NOT WHAT MAKES THE BOARD LIVE. Liveness comes from the board
 * refreshing itself while somebody has it open (app/api/desk/refresh). This
 * covers the other half: kickoff times move, games get flexed, next week's
 * slate appears, and lines drift for days before anyone loads the page. None of
 * that needs a minute's granularity, and all of it is wrong on the board until
 * something syncs.
 *
 * The schedule in vercel.json is DAILY on purpose. Vercel's Hobby plan rejects
 * anything more frequent, and a cron expression that fails to deploy is worse
 * than a slow one. On Pro, hourly ("0 * * * *") or every fifteen minutes during
 * the season is a straight improvement -- the code does not care, only the
 * schedule does. (Written out rather than shown: a quarter-hour cron expression
 * contains the characters that end a block comment, which is worth knowing
 * before you paste one into a doc comment anywhere in this repo.)
 *
 * Next week as well as this one, because "this week" flips the moment the last
 * game of the current one goes final. Syncing only the current week would leave
 * the board landing on a week nobody had fetched the lines for yet.
 */
export async function GET(req: Request) {
  // Vercel signs its cron invocations with CRON_SECRET when the variable is
  // set. Without the check this route is a public endpoint that sweeps ESPN for
  // anyone who finds it. Same guard as the Discord sweep.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient() as any
  const started = Date.now()
  const report: Record<string, unknown> = {}

  for (const sport of DESK_SPORTS) {
    const { data: seasonRow } = await admin
      .from('nfl_games')
      .select('season')
      .eq('sport', sport)
      .order('season', { ascending: false })
      .limit(1)
      .maybeSingle()
    const season: number = seasonRow?.season ?? new Date().getFullYear()

    const { data: weekRows } = await admin
      .from('nfl_games')
      .select('season_type, week, kickoff, status')
      .eq('sport', sport)
      .eq('season', season)

    const active = currentWeekOf(weekRows ?? [], new Date())
    if (!active) {
      report[sport] = { skipped: 'no games' }
      continue
    }

    // The week after this one, rolling into the postseason at the end of the
    // regular one rather than asking for a regular week that does not exist.
    const sweep = deskSweep(sport)
    const next =
      active.season_type === 2 && active.week < sweep.regular
        ? { season_type: 2, week: active.week + 1 }
        : active.season_type === 2
          ? { season_type: 3, week: 1 }
          : { season_type: 3, week: active.week + 1 }

    const targets = [
      { seasonType: active.season_type, week: active.week },
      { seasonType: next.season_type, week: next.week },
    ]

    const result = await syncTargets(admin, {
      sport,
      season,
      targets,
      publishNew: true,
    })
    const { httpStatus, ...payload } = result
    report[sport] = { season, week: active, ...payload }
  }

  const ms = Date.now() - started
  // Logged as well as returned: a cron's response is only visible in the Vercel
  // dashboard, and drift is worth finding in the function logs later.
  console.log('[desk] scheduled sync', JSON.stringify(report), `${ms}ms`)
  return NextResponse.json({ ok: true, ms, ...report })
}
