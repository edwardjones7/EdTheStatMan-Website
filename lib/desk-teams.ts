// Team pages on the Research Desk: one URL per team per league.
//
// SERVER ONLY in practice (it takes an admin client), but it imports nothing
// server-side itself so the path helpers can be used from client components.
//
// A team's address is its ESPN abbreviation, lowercased: /desk/nfl/team/kc,
// /desk/cfb/team/ta%26m. The abbreviation is what nfl_games stores on every row,
// so a team page needs no team table and cannot drift from the schedule. The
// trade is that a team exists only as far as the schedule says it does, which
// is the rule anyway: a team page is offered only for a team in the current
// season's PUBLISHED games, and 404s otherwise.

import type { NflGame } from './nfl'
import { decodeSlugParam } from './nfl'
import { CFB_SCHOOLS } from './teams-cfb'
import { CBB_SCHOOLS } from './teams-cbb'
import { defaultDeskSeason } from './desk'

/** The one URL form for a team page, safe for an href, a canonical or a sitemap. */
export function teamPath(sport: string, abbrev: string): string {
  return `/desk/${encodeURIComponent(sport)}/team/${encodeURIComponent(abbrev.toLowerCase())}`
}

/**
 * A `[abbrev]` route param back to the stored abbreviation.
 *
 * Decoded first for the same reason game slugs are (see decodeSlugParam): page
 * params arrive percent-encoded, and TA&M is a real abbreviation. Stored
 * abbreviations are all upper case, so the URL's lower case maps back exactly.
 * Anything outside the characters an abbreviation can hold is refused here,
 * which keeps the value out of a query entirely.
 */
export function abbrevFromParam(raw: string): string | null {
  const value = decodeSlugParam(raw).trim().toUpperCase()
  return /^[A-Z0-9&\-.']{1,12}$/.test(value) ? value : null
}

/**
 * What a team is called in a heading. College uses the school ("Alabama"),
 * because a list of mascots cannot be read; the pros use the stored full name.
 * Same tables, same reasoning as teamName() on the board.
 */
export function teamShortName(sport: string, abbrev: string, fullName: string): string {
  if (sport === 'cfb') return CFB_SCHOOLS[abbrev] ?? fullName
  if (sport === 'cbb') return CBB_SCHOOLS[abbrev] ?? fullName
  return fullName
}

/**
 * The newest season with a published game in this league.
 *
 * Published only, for every viewer including admins: a team page is a public,
 * indexable URL, and staging next season's schedule must not swap the page out
 * from under the crawler before a game of it is live.
 */
export async function latestPublishedSeason(admin: any, sport: string): Promise<number> {
  const { data } = await admin
    .from('nfl_games')
    .select('season')
    .eq('sport', sport)
    .eq('is_published', true)
    .order('season', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.season ?? defaultDeskSeason(sport)
}

/**
 * Every published game a team plays in a season, in kickoff order.
 *
 * Two equality queries rather than one `.or()`: an abbreviation can carry an
 * `&`, and PostgREST's or-filter grammar would need it quoted and escaped. Two
 * indexed lookups in parallel cost the same round trip and cannot be mis-parsed.
 * Selected with `*` so a column that has not migrated yet (kickoff_tbd) is
 * simply absent rather than failing the query; callers pass rows through
 * toPublicGame() before anything is rendered, so writeup_html never leaves the
 * server. A season is at most ~40 games a team, well under the 1,000-row cap.
 */
export async function teamSeasonGames(
  admin: any,
  sport: string,
  season: number,
  abbrev: string
): Promise<NflGame[]> {
  const side = (col: 'home_abbrev' | 'away_abbrev') => admin
    .from('nfl_games')
    .select('*')
    .eq('sport', sport)
    .eq('season', season)
    .eq('is_published', true)
    .eq(col, abbrev)
  const [home, away] = await Promise.all([side('home_abbrev'), side('away_abbrev')])
  const rows: NflGame[] = [...(home.data ?? []), ...(away.data ?? [])]
  return rows.sort(byKickoff)
}

/** Kickoff order, unplaced games last, id as the tiebreak so it is stable. */
export function byKickoff(a: Pick<NflGame, 'kickoff' | 'id'>, b: Pick<NflGame, 'kickoff' | 'id'>): number {
  const ta = a.kickoff ? Date.parse(a.kickoff) : Infinity
  const tb = b.kickoff ? Date.parse(b.kickoff) : Infinity
  if (ta !== tb) return ta - tb
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}
