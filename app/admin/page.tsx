import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRangeAnalytics, getGlobalTotals } from '@/lib/admin-analytics'
import { loadOps, loadPeople } from '@/lib/admin-people-server'
import { loadProof } from '@/lib/proof'
import AdminDashboard from '@/components/AdminDashboard'
import type { AdminPost } from '@/components/admin/types'

export const metadata: Metadata = {
  title: 'Admin Dashboard – EdTheStatMan',
}

const PAGE_SIZE = 1000

async function fetchPosts(admin: any): Promise<AdminPost[]> {
  const all: AdminPost[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from('posts')
      .select('id, title, slug, tag, access_level, published, published_at, created_at')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    all.push(...((data ?? []) as AdminPost[]))
    if (!data || data.length < PAGE_SIZE) return all
  }
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { view?: string; tab?: string }
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

  const admin = createAdminClient() as any

  // Everything is fetched here in parallel, so the dashboard paints with data.
  // Without it the client has to hydrate and then make its own authenticated
  // round trip before anything beyond a skeleton appears.
  const [peopleLoad, ops, posts, rangeAnalytics, totals, proof] = await Promise.all([
    loadPeople(admin),
    loadOps(admin),
    fetchPosts(admin).catch((e: Error) => {
      console.error(`[admin] posts load failed: ${e.message}`)
      return null
    }),
    getRangeAnalytics(admin, 'month'),
    getGlobalTotals(admin),
    loadProof().catch((e: Error) => {
      console.error(`[admin] records load failed: ${e.message}`)
      return null
    }),
  ])

  return (
    <AdminDashboard
      people={peopleLoad.people}
      purchases={peopleLoad.purchases}
      peopleError={peopleLoad.error}
      ops={ops}
      posts={posts}
      records={proof?.books ?? null}
      initialView={searchParams.view ?? searchParams.tab}
      initialAnalytics={{ ...rangeAnalytics, ...totals }}
    />
  )
}
