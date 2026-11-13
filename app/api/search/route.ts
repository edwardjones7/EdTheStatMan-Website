import { NextResponse } from 'next/server'
import { loadUpcoming, type UpcomingGame } from '@/lib/feeds/upcoming'
import { createCachedClient, DB_TAGS } from '@/lib/supabase/cached'
import { selectAll } from '@/lib/supabase/select-all'
import { LIVE_SPORTS, LIVE_SPORT_LABEL, type LiveSport } from '@/lib/live/types'
import { teamPath, teamShortName } from '@/lib/desk-teams'
import { teamLogoUrl } from '@/lib/logos'
import { vaultRowPath, VAULT_TABLE, type VaultKind } from '@/lib/vault-row'
import type { SearchResponse, SearchTeam, SearchGame, SearchVault } from '@/lib/search-types'

/**
 * The header search: teams, upcoming games and Vault codes.
 *
 * Public and identical for every visitor, so it is cached at the CDN per query
 * and kept out of the auth middleware (see middleware.ts's matcher). Every read
 * underneath is a cached one, and none of them depends on `q`: the query only
 * filters lists that are shared by every search, so a burst of different
 * searches costs the database nothing more than one would.
 *
 * Vault rows return the code, the sport and the link ONLY. A locked row's rule
 * is gated (lib/vault-row.ts), and a search box must not become a way around it.
 */

const LIMIT = { teams: 6, games: 6, vault: 6 }
const SPORT_RANK: Record<string, number> = { nfl: 0, nba: 1, cfb: 2, cbb: 3 }
const CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600'

function norm(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9&]+/g, ' ').trim()
}

/** 3 = exact, 2 = prefix of a word, 1 = substring, 0 = no match. */
function score(q: string, ...fields: (string | null | undefined)[]): number {
  let best = 0
  for (const f of fields) {
    if (!f) continue
    const v = norm(f)
    if (!v) continue
    if (v === q) return 3
    if (v.startsWith(q) || v.split(' ').some(w => w.startsWith(q))) best = Math.max(best, 2)
    else if (v.includes(q)) best = Math.max(best, 1)
  }
  return best
}

function whenText(iso: string | null): string {
  if (!iso) return 'Time TBD'
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })
}

/** Every Vault code, cached and shared by all searches. Codes and sports only. */
async function loadVaultCodes(): Promise<SearchVault[]> {
  const db = createCachedClient([DB_TAGS.vault], 900) as any
  const kinds = Object.keys(VAULT_TABLE) as VaultKind[]
  const lists = await Promise.all(kinds.map(async kind => {
    const { data, error } = await selectAll<{ code: string | null; sport: string | null; is_active: boolean | null }>(() =>
      db.from(VAULT_TABLE[kind]).select('code, sport, is_active').order('code', { ascending: true })
    )
    if (error) console.error(`[search] ${VAULT_TABLE[kind]} read failed: ${error.message}`)
    return data
      .filter(r => r.code && r.is_active !== false)
      .map(r => ({ code: r.code!, sport: r.sport ?? '', kind, href: vaultRowPath(kind, r.code!) }))
  }))
  return lists.flat()
}

export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get('q') ?? '').slice(0, 60)
  const q = norm(raw)
  const empty: SearchResponse = { q: raw, teams: [], games: [], vault: [] }
  if (q.length < 2) {
    return NextResponse.json(empty, { headers: { 'Cache-Control': CACHE } })
  }

  const [upcoming, codes] = await Promise.all([
    loadUpcoming([...LIVE_SPORTS] as LiveSport[], 14),
    /^[a-z0-9 ]+$/.test(q) ? loadVaultCodes().catch(() => [] as SearchVault[]) : Promise.resolve([] as SearchVault[]),
  ])

  // Teams: every side of every game in the next two weeks. A team page exists
  // for any team in the season's published games, and these all are.
  const teamMap = new Map<string, SearchTeam & { s: number }>()
  for (const g of upcoming) {
    for (const side of [
      { abbrev: g.away_abbrev, full: g.away_team },
      { abbrev: g.home_abbrev, full: g.home_team },
    ]) {
      if (!side.abbrev) continue
      const key = `${g.sport}|${side.abbrev}`
      if (teamMap.has(key)) continue
      const name = teamShortName(g.sport, side.abbrev, side.full)
      const s = Math.max(score(q, name, side.full), norm(side.abbrev) === q ? 3 : 0)
      if (s === 0) continue
      teamMap.set(key, {
        sport: g.sport,
        sportLabel: LIVE_SPORT_LABEL[g.sport],
        abbrev: side.abbrev,
        name,
        fullName: side.full,
        href: teamPath(g.sport, side.abbrev),
        logo: teamLogoUrl(g.sport, side.abbrev),
        s,
      })
    }
  }
  const teams: SearchTeam[] = Array.from(teamMap.values())
    // Ties go to the pros: "KC" means the Chiefs before the Roos.
    .sort((a, b) => b.s - a.s || SPORT_RANK[a.sport] - SPORT_RANK[b.sport] || a.name.localeCompare(b.name))
    .slice(0, LIMIT.teams)
    .map(({ s: _s, ...t }) => t)

  const gameScore = (g: UpcomingGame) => Math.max(
    score(q, g.home_team, g.away_team,
      teamShortName(g.sport, g.home_abbrev, g.home_team),
      teamShortName(g.sport, g.away_abbrev, g.away_team)),
    norm(g.home_abbrev ?? '') === q || norm(g.away_abbrev ?? '') === q ? 3 : 0,
  )
  const games: SearchGame[] = upcoming
    .filter(g => g.status !== 'post' && gameScore(g) > 0)
    .sort((a, b) => String(a.kickoff ?? '').localeCompare(String(b.kickoff ?? '')))
    .slice(0, LIMIT.games)
    .map(g => ({
      id: g.id,
      sport: g.sport,
      sportLabel: LIVE_SPORT_LABEL[g.sport],
      label: `${teamShortName(g.sport, g.away_abbrev, g.away_team)} at ${teamShortName(g.sport, g.home_abbrev, g.home_team)}`,
      when: g.status === 'in' ? 'Live now' : whenText(g.kickoff),
      href: g.href,
      awayAbbrev: g.away_abbrev,
      homeAbbrev: g.home_abbrev,
      kickoff: g.kickoff,
    }))

  const cq = q.replace(/ /g, '')
  const vault: SearchVault[] = codes
    .map(v => ({ v, s: v.code.toLowerCase() === cq ? 3 : v.code.toLowerCase().startsWith(cq) ? 2 : v.code.toLowerCase().includes(cq) ? 1 : 0 }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || a.v.code.localeCompare(b.v.code))
    .slice(0, LIMIT.vault)
    .map(x => ({ code: x.v.code, sport: x.v.sport, kind: x.v.kind, href: x.v.href }))

  const body: SearchResponse = { q: raw, teams, games, vault }
  return NextResponse.json(body, { headers: { 'Cache-Control': CACHE } })
}
