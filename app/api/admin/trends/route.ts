import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { supabase, ok: false as const }
  const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
  return { supabase, ok: !!(p as any)?.is_admin as boolean }
}

export async function POST(req: Request) {
  const { supabase, ok } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await supabase.from('betting_trends').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
