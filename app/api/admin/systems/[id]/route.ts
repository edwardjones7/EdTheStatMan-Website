import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, ok: false as const }
  const { data: p } = await (supabase as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { supabase: supabase as any, ok: !!(p as any)?.is_admin as boolean }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { supabase, ok } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { data, error } = await supabase.from('betting_systems').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, ok } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('betting_systems').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
