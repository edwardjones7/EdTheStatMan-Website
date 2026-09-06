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

  // The System ID is the business key, and a duplicate is the mistake a
  // hand-typed sheet actually makes. Caught here, naming both rows, because
  // this is ONE batch insert: left to the unique index it comes back as an
  // opaque 23505 and takes every other row of the import with it.
  const seen = new Map<string, number>()
  for (let i = 0; i < (records as any[]).length; i++) {
    const code = String((records as any[])[i]?.code ?? '').trim().toUpperCase()
    if (!code) continue
    const first = seen.get(code)
    if (first !== undefined) {
      return NextResponse.json(
        { error: `Rows ${first + 1} and ${i + 1} both use the System ID "${code}".` },
        { status: 400 }
      )
    }
    seen.set(code, i)
  }

  const { error } = await admin.from('betting_systems').insert(records)
  if (error) {
    // 23505 is the code unique index. Say which key it was about.
    const message = (error as any).code === '23505'
      ? `One of these IDs is already in the library. Import with "clear first" ticked, or change the duplicate.`
      : error.message
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ inserted: records.length })
}
