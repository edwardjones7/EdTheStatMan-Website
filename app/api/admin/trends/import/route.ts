import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
    const { error: delErr } = await admin.from('betting_trends').delete().gte('sort_order', -999999)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  if (!records?.length) return NextResponse.json({ inserted: 0 })

  // The Trend ID is the business key, and a duplicate is the mistake a
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
        { error: `Rows ${first + 1} and ${i + 1} both use the Trend ID "${code}".` },
        { status: 400 }
      )
    }
    seen.set(code, i)
  }

  const { error } = await admin.from('betting_trends').insert(records)
  if (error) {
    // 23505 is the code unique index. Say which key it was about.
    const message = (error as any).code === '23505'
      ? 'One of these IDs is already in the library. Import with "clear first" ticked, or change the duplicate.'
      : error.message
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ inserted: records.length })
}
