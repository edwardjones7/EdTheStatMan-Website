// Redacted shape for locked systems/trends shown to non-members.
//
// Non-members see PROOF (the record) but never the PRODUCT (the system itself).
// `description` is the intellectual property — the actual betting rule — and
// along with line/team/date/units it must never leave the server.
//
// Build these field by field. `betting_systems` and `betting_trends` are queried
// with select('*'), so any object spread would silently ship every column,
// including columns added in the future.

export interface LockedTeaser {
  id: string
  sport: string
  w: number
  l: number
  t: number
  pct: number | null
}

interface TeaserSource {
  id: string
  sport: string
  w: number | null
  l: number | null
  t: number | null
  pct: number | null
}

export function toTeaser(row: TeaserSource): LockedTeaser {
  return {
    id: row.id,
    sport: row.sport,
    w: row.w ?? 0,
    l: row.l ?? 0,
    t: row.t ?? 0,
    pct: row.pct,
  }
}

/** Cap teasers per sport so the page doesn't become a giant paywall wall. */
export const TEASER_LIMIT_PER_SPORT = 12

// Redacted shape for locked daily picks (`todays_bets`).
//
// Same rule as above: non-members see that a pick EXISTS and how it landed, but
// never the pick. `bet` is the product; `line`, `vig`, `opponent` and `note`
// each narrow it down enough to reconstruct the play, so all five stay server-side.
// Only date, sport and result cross the wire.

export interface LockedBetTeaser {
  id: string
  date: string | null
  sport: string | null
  result: string | null
}

interface BetTeaserSource {
  id: string
  date: string | null
  sport: string | null
  result: string | null
}

export function toBetTeaser(row: BetTeaserSource): LockedBetTeaser {
  return {
    id: row.id,
    date: row.date,
    sport: row.sport,
    result: row.result,
  }
}

/** Cap locked pick rows so the table doesn't turn into a wall of grey bars. */
export const BET_TEASER_LIMIT = 8
