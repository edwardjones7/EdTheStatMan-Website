import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, slug, content, excerpt, tag, access_level, published } = body

  if (!title || !slug || !content || !tag) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await (supabase as any)
    .from('posts')
    .insert({
      title,
      slug,
      content,
      excerpt: excerpt || null,
      tag,
      access_level: access_level ?? 'free',
      published: published ?? false,
      published_at: published ? new Date().toISOString() : null,
      author_id: user.id,
    })
    .select('id, slug')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A post with this slug already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
