import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TIER_RANK } from '@/lib/access'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const { data: p } = await (supabase as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { ok: !!(p as any)?.is_admin as boolean }
}

export async function POST(req: Request) {
  const { ok } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { records, clearFirst } = await req.json()
  const admin = createAdminClient() as any

  if (clearFirst) {
    const { error: delErr } = await admin.from('betting_systems').delete().gte('sort_order', -999999)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (!records?.length) return NextResponse.json({ inserted: 0 })

  // Same gate validation as the single-row routes, and it matters more here:
  // this is one batch insert, so a single bad min_tier is rejected by the CHECK
  // constraint and takes every other row of the import with it. Better a 400
  // naming the row than a 500 naming the constraint.
  const bad = (records as any[]).findIndex(
    r => r?.min_tier !== undefined && r?.min_tier !== null && !(String(r.min_tier) in TIER_RANK)
  )
  if (bad !== -1) {
    return NextResponse.json(
      { error: `Row ${bad + 1} has an unknown min_tier "${(records as any[])[bad].min_tier}".` },
      { status: 400 }
    )
  }

  const { error } = await admin.from('betting_systems').insert(records)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inserted: records.length })
}
