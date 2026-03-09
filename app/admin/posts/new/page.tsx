import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PostEditorClient from '@/components/PostEditorClient'

export const metadata: Metadata = {
  title: 'New Post – Admin',
}

export default async function NewPostPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  return <PostEditorClient />
}
