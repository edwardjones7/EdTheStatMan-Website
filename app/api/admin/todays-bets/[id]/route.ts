import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const admin = createAdminClient()
  const { data: p } = await (admin as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { ok: !!p?.is_admin as boolean, admin: admin as any }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await Promise.resolve(context.params)
  const body = await req.json()
  const { data, error } = await admin.from('todays_bets').update({
    date:            body.date            || null,
    sport:           body.sport           || null,
    risk:            body.risk            || null,
    bet:             body.bet             || null,
    line:            body.line            || null,
    vig:             body.vig             || null,
    win:             body.win             || null,
    result:          body.result          || 'pending',
    note:            body.note            || null,
    is_active:       body.is_active       ?? true,
    is_free:         true,
    show_on_results: body.show_on_results ?? false,
    updated_at:      new Date().toISOString(),
  }).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await Promise.resolve(context.params)
  const { error } = await admin.from('todays_bets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
