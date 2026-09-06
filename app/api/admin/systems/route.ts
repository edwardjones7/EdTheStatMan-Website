import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { TIER_RANK } from '@/lib/access'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, ok: false as const }
  const { data: p } = await (supabase as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { supabase: supabase as any, ok: !!(p as any)?.is_admin as boolean }
}

/**
 * min_tier is a gate, so it is validated rather than trusted, the same way
 * /api/admin/desk-notes does it. Admin-only is not a reason to skip this: a
 * typo'd value would otherwise be rejected by the CHECK constraint as an
 * opaque 500, or -- if the constraint were ever relaxed -- stored and read back
 * through normalizeTier as 'retail', silently publishing a paid row to
 * everyone. Absent is fine; the column has a default.
 */
function badTier(body: any): string | null {
  if (body?.min_tier === undefined || body?.min_tier === null) return null
  const requested = String(body.min_tier)
  return requested in TIER_RANK ? null : `Unknown min_tier "${requested}".`
}

export async function POST(req: Request) {
  const { supabase, ok } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const tierError = badTier(body)
  if (tierError) return NextResponse.json({ error: tierError }, { status: 400 })

  const { data, error } = await supabase.from('betting_systems').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
