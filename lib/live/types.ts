// Shapes shared by the live scores route (server) and the live front-page
// components (browser). Types only: safe to import from either side.

export const LIVE_SPORTS = ['nfl', 'cfb', 'nba', 'cbb'] as const
export type LiveSport = (typeof LIVE_SPORTS)[number]

export const LIVE_SPORT_LABEL: Record<LiveSport, string> = {
  nfl: 'NFL',
  cfb: 'CFB',
  nba: 'NBA',
  cbb: 'CBB',
}

export type LiveState = 'pre' | 'in' | 'post'

export interface LiveTeam {
  abbrev: string
  score: number | null
  record: string | null
}

export interface LiveGame {
  /** Our nfl_games.id, or null when the game is not on the Desk. */
  id: string | null
  espnId: string
  sport: LiveSport
  /** Our game page, or null when the game is not on the Desk. */
  href: string | null
  state: LiveState
  /** ESPN's one-liner: "Q3 4:12", "Halftime", "Final/OT", "11/12 - 8:15 PM EST". */
  detail: string
  period: number
  /** Seconds left in the period, when ESPN gives a clock. */
  clockSeconds: number | null
  kickoff: string | null
  away: LiveTeam
  home: LiveTeam
  /** Football only, while live. */
  possession: 'home' | 'away' | null
  downDistance: string | null
  redZone: boolean
  /** Home-relative spread (negative = home laying points) right now, per ESPN. */
  spread: number | null
  total: number | null
  /** What the Desk has stored, for "moved since open" and "just moved". */
  spreadOpen: number | null
  totalOpen: number | null
  /** True when ESPN's number differs from the Desk's stored current number:
   *  the market moved since the last sync. */
  spreadJustMoved: boolean
  totalJustMoved: boolean
  broadcast: string | null
}

export interface LiveFeed {
  updatedAt: string
  games: LiveGame[]
}

/** How a pick is tracked live. Built on the server from the pick text and the
 *  game it is linked to; only ever built for picks the visitor can see. */
export interface PickTrack {
  pickId: string
  gameId: string
  market: 'spread' | 'total' | 'moneyline' | 'other'
  /** spread / moneyline: the side Ed is on. */
  side: 'home' | 'away' | null
  /** total: over or under. */
  ou: 'over' | 'under' | null
  /** spread: the side's number (e.g. -3.5); total: the total. */
  line: number | null
}
