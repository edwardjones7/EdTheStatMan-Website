import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminDashboard from '@/components/AdminDashboard'

export const metadata: Metadata = {
  title: 'Admin Dashboard – EdTheStatMan',
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: self } = await (supabase as any)
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!self?.is_admin) redirect('/')

  const [{ data: users }, { data: posts }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, subscription_tier, subscription_status, is_admin, stripe_customer_id, stripe_subscription_id, created_at, updated_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('posts')
      .select('id, title, slug, tag, access_level, published, published_at, author_id, created_at, updated_at')
      .order('created_at', { ascending: false }),
  ])

  return (
    <AdminDashboard
      users={users ?? []}
      posts={posts ?? []}
      initialTab={searchParams.tab}
    />
  )
}
