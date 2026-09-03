import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_RANK, normalizeTier } from '@/lib/access'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const admin = createAdminClient()
  const { data: p } = await (admin as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { ok: !!p?.is_admin as boolean, admin: admin as any }
}

/**
 * Upsert the weekly desk note.
 *
 * One note per (sport, season, season_type, week) -- the table's unique
 * constraint enforces that, so this is an upsert rather than a create/update
 * pair and the client never has to track an id.
 */
export async function POST(req: Request) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }

  const sport = String(body.sport ?? 'nfl')
  const season = Number(body.season)
  const seasonType = Number(body.season_type)
  const week = Number(body.week)
  if (!season || !seasonType || !week) {
    return NextResponse.json({ error: 'season, season_type and week are required.' }, { status: 400 })
  }

  // min_tier is a gate, so validate it rather than trusting the client. An
  // unrecognised value would otherwise fall through normalizeTier to 'retail'
  // and silently publish a members-only note to everyone.
  const requested = String(body.min_tier ?? 'desk')
  if (!(requested in TIER_RANK)) {
    return NextResponse.json({ error: `Unknown min_tier "${requested}".` }, { status: 400 })
  }

  const row = {
    sport,
    season,
    season_type: seasonType,
    week,
    title: String(body.title ?? '').slice(0, 200),
    body_html: String(body.body_html ?? ''),
    min_tier: normalizeTier(requested),
    is_published: body.is_published === true,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await admin
    .from('desk_notes')
    .upsert(row, { onConflict: 'sport,season,season_type,week' })
    .select('id, title, min_tier, is_published')
    .single()

  if (error) {
    // The table arrives with tier_ladder_06_desk_games.sql. Say so plainly
    // rather than surfacing a raw Postgres error to the admin bar.
    const missing = /relation .*desk_notes.* does not exist/i.test(error.message)
    return NextResponse.json({
      error: missing
        ? 'desk_notes table not found. Apply tier_ladder_06_desk_games.sql first.'
        : error.message,
    }, { status: missing ? 409 : 500 })
  }

  return NextResponse.json({ note: data })
}
