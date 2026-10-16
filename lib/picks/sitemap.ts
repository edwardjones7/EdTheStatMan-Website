import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { selectAll } from '@/lib/supabase/select-all'
import { toPublicPick } from './public'

/**
 * Sitemap entries for /picks and every pick page worth indexing.
 *
 * Wired into app/sitemap.ts by spreading `...(await pickSitemapEntries(BASE))`.
 *
 * Left out: a members' pick that is still locked. Its page is a sport, a date
 * and a lock -- thin content, and app/picks/[slug] marks it noindex for the
 * same reason. It joins the sitemap once graded, when the page has something
 * to say. Rows are paged (PostgREST stops at 1,000 without saying so).
 *
 * Never throws: a sitemap that fails takes every other URL down with it.
 */
export async function pickSitemapEntries(base = 'https://edthestatman.com'): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/picks`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
  ]
  try {
    const admin = createAdminClient() as any
    const { data } = await selectAll(() => admin.from('todays_bets').select('*').order('id'))
    for (const row of data ?? []) {
      if (row.is_active === false && row.show_on_results !== true) continue
      const pick = toPublicPick(row)
      if (pick.locked) continue
      entries.push({
        url: `${base}/picks/${encodeURIComponent(pick.key)}`,
        lastModified: new Date(pick.updatedAt ?? pick.postedAt ?? Date.now()),
        changeFrequency: pick.result === 'pending' ? 'daily' : 'yearly',
        priority: 0.6,
      })
    }
  } catch {}
  return entries
}
