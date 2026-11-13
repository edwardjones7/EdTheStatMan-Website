// League news from ESPN's public news feed, linked out, never republished.
//
// WHAT WE SHOW: the headline, ESPN's own one-line description, the time, and a
// link to the story on espn.com with "via ESPN". Never the article body and
// never ESPN's photos: a headline and a short summary linking to the source is
// how a news feed stays on the right side of copyright.
//
// COST: one fetch per sport, cached 10 minutes in Next's data cache, shared by
// every visitor. No Supabase.

import type { LiveSport } from '../live/types'

const SITE = 'https://site.api.espn.com/apis/site/v2/sports'
const PATH: Record<LiveSport, string> = {
  nfl: 'football/nfl',
  cfb: 'football/college-football',
  nba: 'basketball/nba',
  cbb: 'basketball/mens-college-basketball',
}
export const ESPN_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible; EdTheStatMan/1.0)', Accept: 'application/json' }

export interface NewsItem {
  id: string
  sport: LiveSport
  headline: string
  description: string | null
  published: string | null
  url: string
  /** Full team names from ESPN's tags ("Cincinnati Bengals"). */
  teams: string[]
}

function clean(s: unknown, max: number): string | null {
  if (typeof s !== 'string') return null
  const t = s.replace(/^[\s—–-]+/, '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > max ? `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : t
}

export async function loadNews(sport: LiveSport, limit = 12): Promise<NewsItem[]> {
  try {
    const res = await fetch(`${SITE}/${PATH[sport]}/news?limit=${limit + 8}`, {
      headers: ESPN_HEADERS,
      next: { revalidate: 600, tags: ['feed:news'] },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    const out: NewsItem[] = []
    for (const a of (json?.articles ?? []) as any[]) {
      const url = a?.links?.web?.href
      const headline = clean(a?.headline, 140)
      if (!url || !headline || !/^https:\/\/(www\.)?espn\.com\//.test(url)) continue
      out.push({
        id: String(a.id ?? url),
        sport,
        headline,
        description: clean(a?.description, 180),
        published: a?.published ?? a?.lastModified ?? null,
        url,
        teams: ((a?.categories ?? []) as any[])
          .filter(c => c?.type === 'team' && c?.description)
          .map(c => String(c.description)),
      })
      if (out.length >= limit) break
    }
    return out
  } catch (e) {
    console.error(`[news] ${sport} failed: ${(e as Error).message}`)
    return []
  }
}
