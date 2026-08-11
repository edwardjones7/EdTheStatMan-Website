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

// Admin-owned fields only. Sync-owned columns (teams, kickoff, scores, status)
// change exclusively through /api/admin/nfl-sync, and slug is frozen for SEO.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (typeof body.brief === 'string') update.brief = body.brief
  if (typeof body.is_published === 'boolean') update.is_published = body.is_published
  if (typeof body.writeup_html === 'string') {
    update.writeup_html = body.writeup_html
    update.writeup_updated_at = new Date().toISOString()
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No editable fields in request.' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('nfl_games')
    .update(update)
    .eq('id', params.id)
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// Replaces the game's curated system/trend links wholesale.
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const systemIds: string[] = Array.isArray(body.systemIds) ? body.systemIds : []
  const trendIds: string[] = Array.isArray(body.trendIds) ? body.trendIds : []

  const { error: delSysError } = await admin.from('nfl_game_systems').delete().eq('game_id', params.id)
  if (delSysError) return NextResponse.json({ error: delSysError.message }, { status: 500 })
  const { error: delTrendError } = await admin.from('nfl_game_trends').delete().eq('game_id', params.id)
  if (delTrendError) return NextResponse.json({ error: delTrendError.message }, { status: 500 })

  if (systemIds.length > 0) {
    const { error } = await admin
      .from('nfl_game_systems')
      .insert(systemIds.map(id => ({ game_id: params.id, system_id: id })))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (trendIds.length > 0) {
    const { error } = await admin
      .from('nfl_game_trends')
      .insert(trendIds.map(id => ({ game_id: params.id, trend_id: id })))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
