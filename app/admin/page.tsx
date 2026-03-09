import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminDashboard from '@/components/AdminDashboard'

export const metadata: Metadata = {
  title: 'Admin Dashboard – EdTheStatMan',
}

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const { data: self } = await (supabase as any)
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!self?.is_admin) redirect('/')

  const [{ data: users }, { data: posts }, { data: systems }, { data: trends }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, subscription_tier, subscription_status, is_admin, stripe_customer_id, stripe_subscription_id, created_at, updated_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('posts')
      .select('id, title, slug, tag, access_level, published, published_at, author_id, created_at, updated_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('betting_systems')
      .select('*')
      .order('sort_order', { ascending: true }),
    supabase
      .from('betting_trends')
      .select('*')
      .order('sport', { ascending: true })
      .order('sort_order', { ascending: true }),
  ])

  return (
    <AdminDashboard
      users={users ?? []}
      posts={posts ?? []}
      systems={(systems ?? []) as any[]}
      trends={(trends ?? []) as any[]}
    />
  )
}
