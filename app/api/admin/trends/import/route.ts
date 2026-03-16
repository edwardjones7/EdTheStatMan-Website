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

  const { error } = await admin.from('betting_trends').insert(records)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inserted: records.length })
}
