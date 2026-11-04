import { withCronLog } from '@/lib/cron-log'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ingestFromX } from '@/lib/picks/drafts'

export const dynamic = 'force-dynamic'
// Up to 25 posts, each one model call of a few seconds.
export const maxDuration = 120

/**
 * Pull Ed's new X posts into the pick queue (pick_drafts). Queues only:
 * nothing reaches the site until Ed approves it in the admin Pick Queue tab.
 *
 * SCHEDULE. vercel.json runs this DAILY, for the same reason desk-sync is
 * daily: the Hobby plan rejects any cron more frequent than once a day, and a
 * cron expression that fails to deploy takes the whole deploy with it. On Pro,
 * every fifteen minutes is the intended cadence (minute field "star slash 15",
 * spelled out because those characters end a block comment). Until then, the
 * "Pull from X now" button in the queue runs this same ingest on demand.
 *
 * With X unconfigured this answers 200 with a `skipped` reason: an unset
 * feature is not a failing cron.
 */
async function run(req: Request) {
  // Vercel signs cron invocations with CRON_SECRET when it is set. Same guard
  // as desk-sync and the Discord sweep: without it, anyone could run up the X
  // and AI bills by hitting this URL.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const started = Date.now()
  const report = await ingestFromX(createAdminClient() as any)
  const ms = Date.now() - started
  // Logged as well as returned: a cron's response is only visible in the
  // Vercel dashboard.
  console.log('[x-ingest]', JSON.stringify(report), `${ms}ms`)
  return NextResponse.json({ ...report, ms })
}

export const GET = withCronLog('x-ingest', run)
