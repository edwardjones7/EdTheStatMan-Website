// Shapes returned by /api/search, shared by the route and the header search.
// Types only: safe to import from either side.

export interface SearchTeam {
  sport: string
  sportLabel: string
  abbrev: string
  /** What the team is called in a heading (the school, for college). */
  name: string
  fullName: string
  href: string
  logo: string | null
}

export interface SearchGame {
  id: string
  sport: string
  sportLabel: string
  /** "Buffalo Bills at Kansas City Chiefs" */
  label: string
  when: string
  href: string
  awayAbbrev: string
  homeAbbrev: string
  kickoff: string | null
}

/** A Vault row as search may show it: never the rule, which can be gated. */
export interface SearchVault {
  code: string
  sport: string
  kind: 'systems' | 'trends'
  href: string
}

export interface SearchResponse {
  q: string
  teams: SearchTeam[]
  games: SearchGame[]
  vault: SearchVault[]
}
