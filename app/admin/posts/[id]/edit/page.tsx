import type { Metadata } from 'next'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PostEditorClient from '@/components/PostEditorClient'

export const metadata: Metadata = {
  title: 'Edit Post – Admin',
}

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  const { data: post } = await supabase
    .from('posts')
    .select('id, title, slug, content, excerpt, tag, access_level, published')
    .eq('id', params.id)
    .single()

  if (!post) notFound()

  return <PostEditorClient post={post} />
}
