import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminDashboard from '@/components/AdminDashboard'

export const metadata: Metadata = {
  title: 'Admin Dashboard – EdTheStatMan',
}

const PAGE_SIZE = 1000

async function fetchAllPaged<T>(
  buildQuery: (from: number, to: number) => any,
): Promise<T[]> {
  let all: T[] = []
  let from = 0
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all = all.concat(data as T[])
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
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

  const admin = createAdminClient()

  const [users, posts] = await Promise.all([
    fetchAllPaged<any>((from, to) =>
      (admin as any)
        .from('profiles')
        .select('id, email, full_name, subscription_tier, subscription_status, is_admin, stripe_customer_id, stripe_subscription_id, created_at, updated_at, last_seen_at')
        .order('last_seen_at', { ascending: false, nullsFirst: false })
        .range(from, to),
    ),
    fetchAllPaged<any>((from, to) =>
      (admin as any)
        .from('posts')
        .select('id, title, slug, tag, access_level, published, published_at, author_id, created_at, updated_at')
        .order('created_at', { ascending: false })
        .range(from, to),
    ),
  ])

  return (
    <AdminDashboard
      users={users}
      posts={posts}
      initialTab={searchParams.tab}
    />
  )
}
