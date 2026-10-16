import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { DESK_SPORTS } from '@/lib/desk'
import { gamePath } from '@/lib/nfl'
import { selectAll } from '@/lib/supabase/select-all'
import { seoSitemapEntries } from '@/lib/seo-sitemap'

const BASE = 'https://edthestatman.com'

// Without this the sitemap was prerendered once at build, so every game
// published after a deploy stayed out of it until the next one.
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient()

  // Games are paged: there are several thousand published rows across the four
  // leagues, and an unpaged read stopped at exactly 1,000 (lib/supabase/select-all.ts).
  const [{ data: posts }, { data: allGames }] = await Promise.all([
    (admin as any).from('posts').select('slug, updated_at').eq('published', true),
    selectAll(() => (admin as any)
      .from('nfl_games')
      .select('slug, sport, updated_at, spread_current, total_current')
      .eq('is_published', true)
      .order('id')),
  ])

  // A college basketball week is 250 to 470 games, most of them small-school
  // matchups ESPN never prices. Without a line the page is a schedule entry and
  // nothing else, and thousands of those would read as thin content. List one
  // once it has a market; the page itself stays reachable either way.
  const games = allGames.filter((g: any) =>
    g.sport !== 'cbb' || g.spread_current != null || g.total_current != null
  )

  // Grouped by product, and every URL is a v3 path. The six pre-v3 routes are
  // 308s now (next.config.js), and a sitemap that lists a redirect asks every
  // crawler to take the hop before it finds the page it was going to index.
  // /desk is absent for the same reason: it is a bare redirect into the first
  // board (app/desk/page.tsx), not a page. /vault and /portfolio are real.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },

    { url: `${BASE}/portfolio`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/portfolio/performance`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },

    { url: `${BASE}/vault`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/vault/systems`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/vault/trends`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },

    ...DESK_SPORTS.map(sport => ({
      url: `${BASE}/desk/${sport}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),

    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/win`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/responsible-gaming`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.2 },
  ]

  const blogRoutes: MetadataRoute.Sitemap = (posts ?? []).map((post: any) => ({
    url: `${BASE}/blog/${post.slug}`,
    lastModified: post.updated_at ? new Date(post.updated_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  // A game lives under its own league's board. Emitting every row under /nfl
  // both published a dead path (the v3 rename moved it to /desk/[sport]/g) and,
  // now that the table holds more than one league, filed college games under
  // the NFL.
  const gameRoutes: MetadataRoute.Sitemap = (games ?? []).map((game: any) => ({
    url: `${BASE}${gamePath(game.sport ?? 'nfl', game.slug)}`,
    lastModified: game.updated_at ? new Date(game.updated_at) : new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }))

  // Team pages and Vault row pages (lib/seo-sitemap.ts).
  const seoRoutes = await seoSitemapEntries()

  return [...staticRoutes, ...blogRoutes, ...gameRoutes, ...seoRoutes]
}
