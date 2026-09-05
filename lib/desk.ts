// Sport vocabulary, defined once.
//
// These lists were previously duplicated across SportTabsSystem.tsx,
// TrendsFilter.tsx, AdminSystemsTab.tsx and AdminTrendsTab.tsx, plus a CHECK
// constraint in betting_tables.sql. Adding a sport meant editing five places
// and remembering the migration. New code should import from here.

export const SPORTS = ['nfl', 'nflpre', 'cfb', 'cfl', 'nba', 'wnba', 'cbb'] as const
export type Sport = (typeof SPORTS)[number]

export const SPORT_LABEL: Record<Sport, string> = {
  nfl: 'NFL',
  nflpre: 'NFL Preseason',
  cfb: 'College Football',
  cfl: 'CFL',
  nba: 'NBA',
  wnba: 'WNBA',
  cbb: 'College Basketball',
}

/** Badge-width codes. SPORT_LABEL is too long for a table cell. */
export const SPORT_SHORT: Record<Sport, string> = {
  nfl: 'NFL',
  nflpre: 'NFL PRE',
  cfb: 'CFB',
  cfl: 'CFL',
  nba: 'NBA',
  wnba: 'WNBA',
  cbb: 'CBB',
}

/**
 * Sports the Research Desk currently has a schedule for.
 *
 * Kept separate from SPORTS because the Vault carries systems and trends for
 * sports the Desk has no game data for yet. Adding a sport here is content
 * work — the tables and routes are already keyed by sport — but only do it once
 * the sync actually populates that league.
 */
export const DESK_SPORTS = ['nfl', 'cfb'] as const
export type DeskSport = (typeof DESK_SPORTS)[number]

/**
 * How far the ESPN sweep runs for each league, because the two football
 * seasons are not the same shape.
 *
 * NFL is 18 regular weeks and 5 postseason weeks (wild card through the Pro
 * Bowl and Super Bowl). College is 16 regular weeks -- week 15 is Army-Navy
 * and week 16 the last of the conference title games -- and the entire bowl
 * and playoff slate arrives as postseason week 1, 46 games at once. Probed
 * against cdn.espn.com 2026-09-05: college postseason weeks 2 and 3 answer
 * with HTML rather than JSON, so sweeping them is a reported failure on every
 * run rather than an empty week. Ask for what exists.
 */
export const DESK_SWEEP: Record<DeskSport, { regular: number; post: number }> = {
  nfl: { regular: 18, post: 5 },
  cfb: { regular: 16, post: 1 },
}

export function deskSweep(sport: string): { regular: number; post: number } {
  return DESK_SWEEP[sport as DeskSport] ?? DESK_SWEEP.nfl
}

export function deskSportLabel(sport: string): string {
  return SPORT_LABEL[sport as Sport] ?? sport.toUpperCase()
}

export function isSport(value: string): value is Sport {
  return (SPORTS as readonly string[]).includes(value)
}
