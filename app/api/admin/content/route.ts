import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { supabase: supabase as any, ok: false as const }
  const { data: p } = await (supabase as any)
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()
  return { supabase: supabase as any, ok: !!(p as any)?.is_admin as boolean }
}

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await (supabase as any).from('site_content').select('key, value')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const content: Record<string, unknown> = {}
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    content[row.key] = row.value
  }
  return NextResponse.json(content)
}

export async function PATCH(req: Request) {
  const { supabase, ok } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { key, value } = body
  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('site_content')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  return NextResponse.json({ success: true })
}
