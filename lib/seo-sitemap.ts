// Sitemap entries for the SEO page families: Desk team pages and Vault row pages.
//
// Kept out of app/sitemap.ts so that file stays a list of sources; it spreads
// `...(await seoSitemapEntries())` into its return.
//
// Every read is paged through selectAll(): a college basketball season alone is
// thousands of nfl_games rows, and PostgREST stops at 1,000 without a word.

import type { MetadataRoute } from 'next'
import { createCachedClient, DB_TAGS } from './supabase/cached'
import { selectAll } from './supabase/select-all'
import { DESK_SPORTS } from './desk'
import { latestPublishedSeason, teamPath } from './desk-teams'
import { codeFromParam, vaultRowPath, VAULT_TABLE, type VaultKind } from './vault-row'

const BASE = 'https://edthestatman.com'

type TeamRow = {
  home_abbrev: string
  away_abbrev: string
  spread_current: number | null
  total_current: number | null
  updated_at: string | null
}

export async function seoSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  const admin = createCachedClient([DB_TAGS.games, DB_TAGS.vault], 3600)
  const [teams, systems, trends] = await Promise.all([
    teamEntries(admin),
    vaultEntries(admin, 'systems'),
    vaultEntries(admin, 'trends'),
  ])
  return [...teams, ...systems, ...trends]
}

/**
 * One URL per team with a published game in its league's current season --
 * exactly the set app/desk/[sport]/team/[abbrev] answers 200 for.
 *
 * College basketball is narrowed further, for the same reason app/sitemap.ts
 * drops its unpriced games: the schedule carries hundreds of small-school
 * opponents ESPN never prices, and a team page with no line on it is a list of
 * dates. The page still resolves; it is just not advertised.
 */
async function teamEntries(admin: any): Promise<MetadataRoute.Sitemap> {
  const perSport = await Promise.all(DESK_SPORTS.map(async sport => {
    const season = await latestPublishedSeason(admin, sport)
    const { data } = await selectAll<TeamRow>(() => admin
      .from('nfl_games')
      .select('id, home_abbrev, away_abbrev, spread_current, total_current, updated_at')
      .eq('sport', sport)
      .eq('season', season)
      .eq('is_published', true)
      .order('id'))

    const latest = new Map<string, number>()
    const priced = new Set<string>()
    for (const r of data) {
      const at = r.updated_at ? Date.parse(r.updated_at) : 0
      const hasLine = r.spread_current != null || r.total_current != null
      for (const abbrev of [r.home_abbrev, r.away_abbrev]) {
        if (!abbrev) continue
        latest.set(abbrev, Math.max(latest.get(abbrev) ?? 0, at))
        if (hasLine) priced.add(abbrev)
      }
    }

    return [...latest.entries()]
      .filter(([abbrev]) => sport !== 'cbb' || priced.has(abbrev))
      .map(([abbrev, at]) => ({
        url: `${BASE}${teamPath(sport, abbrev)}`,
        lastModified: at ? new Date(at) : new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }))
  }))
  return perSport.flat()
}

/**
 * One URL per active, coded Vault row. Inactive rows 404 for the public and are
 * never advertised (lib/gate.ts), and an uncoded row has no address.
 *
 * Before vault_01_row_codes.sql the `code` column does not exist and the read
 * errors; that yields no entries rather than failing the whole sitemap.
 */
async function vaultEntries(admin: any, kind: VaultKind): Promise<MetadataRoute.Sitemap> {
  const { data, error } = await selectAll<{ code: string | null; updated_at: string | null }>(() => admin
    .from(VAULT_TABLE[kind])
    .select('id, code, updated_at')
    .eq('is_active', true)
    .not('code', 'is', null)
    .order('id'))
  if (error) return []
  // Only codes the page would resolve as stored: anything codeFromParam would
  // reshape (stray case, whitespace, punctuation) would be a sitemap 404.
  return data
    .filter(r => r.code && codeFromParam(r.code) === r.code)
    .map(r => ({
      url: `${BASE}${vaultRowPath(kind, r.code!)}`,
      lastModified: r.updated_at ? new Date(r.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
}
