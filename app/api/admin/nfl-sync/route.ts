import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTargets, type SyncTarget } from '@/lib/desk-sync'
import { deskSweep } from '@/lib/desk'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const admin = createAdminClient()
  const { data: p } = await (admin as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { ok: !!p?.is_admin as boolean, admin: admin as any }
}

/**
 * The admin sync button. Sweeps a whole season by default.
 *
 * The work itself lives in lib/desk-sync.ts, shared with the board's own
 * refresh and the cron -- this route is the admin gate and the week selection,
 * nothing more.
 */
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
  const targets: SyncTarget[] = []
  if (body.seasonType && body.week) {
    targets.push({ seasonType: Number(body.seasonType), week: Number(body.week) })
  } else {
    for (let w = 1; w <= sweep.regular; w++) targets.push({ seasonType: 2, week: w })
    for (let w = 1; w <= sweep.post; w++) targets.push({ seasonType: 3, week: w })
  }

  const result = await syncTargets(admin, { sport, season, targets, publishNew })
  const { httpStatus, ...payload } = result
  return NextResponse.json(payload, { status: httpStatus })
}
