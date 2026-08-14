import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyNewPick } from '@/lib/notify'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const admin = createAdminClient()
  const { data: p } = await (admin as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { ok: !!p?.is_admin as boolean, admin: admin as any }
}

export async function POST(req: Request) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await admin.from('todays_bets').insert({
    date:            body.date            || null,
    sport:           body.sport           || null,
    risk:            body.risk            || null,
    bet:             body.bet             || null,
    line:            body.line            || null,
    vig:             body.vig             || null,
    opponent:        body.opponent        || null,
    win:             body.win             || null,
    result:          body.result          || 'pending',
    note:            body.note            || null,
    is_active:       body.is_active       ?? true,
    is_free:         body.is_free         ?? true,
    is_elite:        body.is_elite        ?? false,
    show_on_results: body.show_on_results ?? false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Announce the pick. Awaited rather than fire-and-forget: on Vercel the
  // function can be frozen once the response is returned, which would drop
  // in-flight sends. notifyNewPick never throws, so this can't fail the insert.
  // Pass notify:false in the body to save a pick silently.
  const notified = body.notify === false
    ? { skipped: 'suppressed by request' }
    : await notifyNewPick(data)

  return NextResponse.json({ ...data, notified }, { status: 201 })
}
