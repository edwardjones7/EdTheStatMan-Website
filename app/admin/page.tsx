import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AdminDashboard from '@/components/AdminDashboard'
import { SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import type { AllSiteContent } from '@/lib/site-content'

export const metadata: Metadata = {
  title: 'Admin Dashboard – EdTheStatMan',
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string }
}) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/login')

  const { data: self } = await (supabase as any)
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!self?.is_admin) redirect('/')

  const [{ data: users }, { data: posts }, { data: systems }, { data: trends }, { data: contentRows }] = await Promise.all([
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
    (supabase as any)
      .from('site_content')
      .select('key, value'),
  ])

  const raw: Record<string, unknown> = {}
  for (const row of (contentRows ?? []) as { key: string; value: unknown }[]) {
    raw[row.key] = row.value
  }

  const content: AllSiteContent = {
    hero:             { ...SITE_CONTENT_DEFAULTS.hero,             ...(raw.hero             as object ?? {}) },
    action_card:      { ...SITE_CONTENT_DEFAULTS.action_card,      ...(raw.action_card      as object ?? {}) },
    features:         { ...SITE_CONTENT_DEFAULTS.features,         ...(raw.features         as object ?? {}) },
    cta_section:      { ...SITE_CONTENT_DEFAULTS.cta_section,      ...(raw.cta_section      as object ?? {}) },
    statbot_preview:  { ...SITE_CONTENT_DEFAULTS.statbot_preview,  ...(raw.statbot_preview  as object ?? {}) },
    systems_overview: { ...SITE_CONTENT_DEFAULTS.systems_overview, ...(raw.systems_overview as object ?? {}) },
  }

  return (
    <AdminDashboard
      users={users ?? []}
      posts={posts ?? []}
      systems={(systems ?? []) as any[]}
      trends={(trends ?? []) as any[]}
      content={content}
      initialTab={searchParams.tab}
    />
  )
}
