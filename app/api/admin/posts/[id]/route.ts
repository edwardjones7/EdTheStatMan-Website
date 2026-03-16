import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, isAdmin: false }

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  return { supabase, user, isAdmin: !!profile?.is_admin }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user, isAdmin } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, slug, content, excerpt, tag, access_level, published } = body

  // Fetch current published state to manage published_at
  const { data: existing } = await (supabase as any)
    .from('posts')
    .select('published, published_at')
    .eq('id', params.id)
    .single()

  const publishedAt =
    published && !existing?.published_at
      ? new Date().toISOString()
      : existing?.published_at ?? null

  const { data, error } = await (supabase as any)
    .from('posts')
    .update({
      title,
      slug,
      content,
      excerpt: excerpt || null,
      tag,
      access_level,
      published,
      published_at: published ? publishedAt : null,
    })
    .eq('id', params.id)
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A post with this slug already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user, isAdmin } = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await (supabase as any)
    .from('posts')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
