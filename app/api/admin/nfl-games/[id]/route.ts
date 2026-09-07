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
  // Open or shut the Desk rung's in-context view of this game's curated rows.
  // Sent as a boolean and stamped here, so the moment recorded is the server's
  // and an admin cannot accidentally backdate one. See
  // supabase/migrations/desk_01_research_closed.sql.
  //
  // Probed rather than assumed, the same way the sync probes for the desk
  // columns: the panel sends this field on every save, so on a deployment where
  // the migration has not been run yet an unconditional write would fail the
  // WHOLE save -- brief, writeup and published state with it -- for a column
  // nobody has asked about. Better to drop this one field and still save the
  // writing.
  if (typeof body.research_closed === 'boolean') {
    const { error: probe } = await admin.from('nfl_games').select('research_closed_at').limit(1)
    if (!probe) {
      update.research_closed_at = body.research_closed ? new Date().toISOString() : null
    }
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
