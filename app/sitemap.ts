import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

const BASE = 'https://edthestatman.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient()

  const { data: posts } = await (admin as any)
    .from('posts')
    .select('slug, updated_at')
    .eq('published', true)

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/betting-systems`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/betting-trends`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/results`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/pricing`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]

  const blogRoutes: MetadataRoute.Sitemap = (posts ?? []).map((post: any) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticRoutes, ...blogRoutes]
}
