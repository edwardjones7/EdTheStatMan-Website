// Team logos, resolved from data we already store.
//
// ESPN serves team logos from a deterministic CDN path keyed by the same
// abbreviation lib/espn.ts already writes into nfl_games.home_abbrev /
// away_abbrev, so no new column, no new sync and no new vendor is needed.
//
// CLOSED SET ON PURPOSE. teamLogoUrl() returns a URL only for an abbreviation
// on the verified list below; anything else returns null and the caller falls
// back to the typographic tile. The alternative -- constructing a URL from
// whatever string is in the row and letting the browser 404 -- needs an onError
// handler, which makes every card a client component and still flashes a broken
// image first. A row that cannot be resolved should render as clean type, not
// as a hole.
//
// All 32 paths were verified against the CDN (200, image/png) on 2026-09-03.
//
// CFB works differently and is handled separately: ESPN keys college logos by
// numeric team id rather than by abbreviation, so lib/logos-cfb.ts carries a
// generated abbrev->id table. It is safe to key that table on the abbreviation
// because a full-season sweep found zero collisions across 243 programs.
//
// NOT SUPPORTED, deliberately:
//   - CFL / WNBA / CBB. Not on this CDN path at all.
//   - todays_bets. That table has no team column; the pick is free text in
//     `bet` with `opponent` alongside, so there is nothing reliable to key on.
// Each of those renders the typographic mark instead, which is why the fallback
// is the common path rather than an error case.

import { CFB_TEAM_IDS } from './logos-cfb'

/** ESPN's NFL abbreviations. The sync writes these verbatim. */
const NFL_ABBREVS = new Set([
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LAC', 'LAR', 'LV', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WSH',
])

/** Sports whose abbreviations resolve on the ESPN CDN. See header. */
const LOGO_SPORTS: Record<string, Set<string>> = {
  nfl: NFL_ABBREVS,
  // nflpre reuses the same franchises and therefore the same logos.
  nflpre: NFL_ABBREVS,
}

/**
 * A logo URL for this team, or null when we cannot resolve one honestly.
 *
 * Returning null is the normal path for every sport but NFL — callers must
 * render a typographic fallback rather than treating null as an error.
 */
export function teamLogoUrl(sport: string, abbrev: string | null | undefined): string | null {
  if (!abbrev) return null
  const league = sport?.toLowerCase() ?? ''
  const key = abbrev.trim().toUpperCase()

  // 500px is the smallest square ESPN publishes that still looks right on a
  // 2x display at the ~28-40px we render it.
  if (league === 'cfb') {
    const id = CFB_TEAM_IDS[key]
    return id ? `https://a.espncdn.com/i/teamlogos/ncaa/500/${id}.png` : null
  }

  // Every other supported league puts the abbreviation straight in the path.
  const known = LOGO_SPORTS[league]
  if (!known || !known.has(key)) return null
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${key.toLowerCase()}.png`
}

/** True when this team will render as a logo rather than as type. */
export function hasLogo(sport: string, abbrev: string | null | undefined): boolean {
  return teamLogoUrl(sport, abbrev) !== null
}
