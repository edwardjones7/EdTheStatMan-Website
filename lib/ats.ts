// Against-the-spread and over/under results, computed from the row.
//
// Pure module: the board (a client component), the game page, the team pages
// and anything else can import it without dragging a server client along.
//
// THE CLOSING LINE. Every result here is graded against `spread_current` and
// `total_current`, which for a played game ARE the close: ESPN drops the odds
// block the moment a game leaves `pre`, and protectStoredOdds() in lib/espn.ts
// refuses to write that absence back, so the last number captured before
// kickoff is what stays in the row. The opener is never used for grading --
// "covered the opener" is not a thing anyone bets.
//
// DO NOT use ESPN's own `spreadWinner` / `moneylineWinner` flags instead. They
// read false on every completed game probed (Open.md). The cover is computed
// here from the score and the line, or not at all.
//
// The spread is HOME-RELATIVE: -3.5 means the home side lays 3.5, +3.5 means
// the away side does. A team's own line is that number for the home team and
// its negation for the away team.

/** The fields grading reads. PublicNflGame and NflGame both satisfy it. */
export interface GradableGame {
  status: string
  home_abbrev: string
  away_abbrev: string
  home_score: number | null
  away_score: number | null
  spread_current?: number | null
  total_current?: number | null
}

export type AtsSide = 'home' | 'away' | 'push'
export type OuResult = 'over' | 'under' | 'push'
export type TeamAts = 'W' | 'L' | 'P'
export type TeamSu = 'W' | 'L' | 'T'

const has = (n: number | null | undefined): n is number =>
  n !== null && n !== undefined && Number.isFinite(n)

/**
 * A game that can be graded: marked final AND carrying both scores.
 *
 * Status, not the clock. A game whose sync stalled on `pre` still has 0-0 or
 * null scores, and grading it would invent a result.
 */
export function isGradable(g: GradableGame): boolean {
  return g.status === 'post' && has(g.home_score) && has(g.away_score)
}

/** Who covered the closing spread, or null when it cannot be said. */
export function atsResult(g: GradableGame): AtsSide | null {
  if (!isGradable(g) || !has(g.spread_current)) return null
  // Home margin plus the home line: positive means home covered.
  const m = (g.home_score! - g.away_score!) + g.spread_current
  // Rounded so float noise on a .5 line can never fake a push.
  const r = Math.round(m * 100) / 100
  return r > 0 ? 'home' : r < 0 ? 'away' : 'push'
}

/** Over, under or push against the closing total, or null. */
export function ouResult(g: GradableGame): OuResult | null {
  if (!isGradable(g) || !has(g.total_current)) return null
  const pts = g.home_score! + g.away_score!
  const r = Math.round((pts - g.total_current) * 100) / 100
  return r > 0 ? 'over' : r < 0 ? 'under' : 'push'
}

/**
 * A line as it is printed: "−3.5", "+7", "PK".
 *
 * A real minus sign (U+2212), not a hyphen, because this is a number a reader
 * scans and the hyphen is visibly shorter than the plus beside it.
 */
export function signedLine(n: number): string {
  if (n === 0) return 'PK'
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`
}

/** This team's own closing line, or null when there is none. */
export function teamLine(g: GradableGame, abbrev: string): number | null {
  if (!has(g.spread_current)) return null
  if (g.home_abbrev === abbrev) return g.spread_current
  if (g.away_abbrev === abbrev) return g.spread_current === 0 ? 0 : -g.spread_current
  return null
}

/**
 * The ATS tag a final game wears, e.g. "KC covered −3.5" or "Push · KC −3".
 *
 * The covering team is named with ITS line, so an underdog cover reads
 * "NYJ covered +6.5" rather than restating the favourite's number.
 */
export function atsTag(g: GradableGame): { label: string; side: AtsSide } | null {
  const side = atsResult(g)
  if (!side) return null
  if (side === 'push') {
    // A push is named from the favourite's side, which is how the line was quoted.
    const fav = g.spread_current! <= 0 ? g.home_abbrev : g.away_abbrev
    return { side, label: `Push · ${fav} ${signedLine(teamLine(g, fav)!)}` }
  }
  const team = side === 'home' ? g.home_abbrev : g.away_abbrev
  return { side, label: `${team} covered ${signedLine(teamLine(g, team)!)}` }
}

/** The O/U tag a final game wears, e.g. "Over 44.5". */
export function ouTag(g: GradableGame): { label: string; result: OuResult } | null {
  const result = ouResult(g)
  if (!result) return null
  const word = result === 'over' ? 'Over' : result === 'under' ? 'Under' : 'Push'
  return { result, label: `${word} ${g.total_current}` }
}

/** This team's ATS result in one game, or null. */
export function teamAtsResult(g: GradableGame, abbrev: string): TeamAts | null {
  const side = atsResult(g)
  if (!side) return null
  if (side === 'push') return 'P'
  const mine = g.home_abbrev === abbrev ? 'home' : g.away_abbrev === abbrev ? 'away' : null
  if (!mine) return null
  return side === mine ? 'W' : 'L'
}

/** This team's straight-up result in one game, or null. */
export function teamSuResult(g: GradableGame, abbrev: string): TeamSu | null {
  if (!isGradable(g)) return null
  const mine = g.home_abbrev === abbrev ? g.home_score! : g.away_abbrev === abbrev ? g.away_score! : null
  const theirs = g.home_abbrev === abbrev ? g.away_score! : g.away_abbrev === abbrev ? g.home_score! : null
  if (mine === null || theirs === null) return null
  return mine > theirs ? 'W' : mine < theirs ? 'L' : 'T'
}

export interface TeamSeasonSummary {
  /** Straight up. Ties exist in the NFL and nowhere else on the Desk. */
  su: { w: number; l: number; t: number }
  ats: { w: number; l: number; p: number }
  ou: { o: number; u: number; p: number }
  /** Final games counted for SU. ATS and O/U can be fewer: not every final had a line. */
  finals: number
}

/**
 * A team's season in three records, from whatever games are passed.
 *
 * Games the team is not in, and games that cannot be graded, are skipped
 * rather than counted as anything, so callers can hand over a whole schedule.
 */
export function teamSeasonSummary(games: GradableGame[], abbrev: string): TeamSeasonSummary {
  const out: TeamSeasonSummary = {
    su: { w: 0, l: 0, t: 0 },
    ats: { w: 0, l: 0, p: 0 },
    ou: { o: 0, u: 0, p: 0 },
    finals: 0,
  }
  for (const g of games) {
    const su = teamSuResult(g, abbrev)
    if (!su) continue
    out.finals++
    if (su === 'W') out.su.w++
    else if (su === 'L') out.su.l++
    else out.su.t++

    const ats = teamAtsResult(g, abbrev)
    if (ats === 'W') out.ats.w++
    else if (ats === 'L') out.ats.l++
    else if (ats === 'P') out.ats.p++

    const ou = ouResult(g)
    if (ou === 'over') out.ou.o++
    else if (ou === 'under') out.ou.u++
    else if (ou === 'push') out.ou.p++
  }
  return out
}

/** "7-3" or "7-3-1": the third number only when it is not zero. */
export function recordText(a: number, b: number, c = 0): string {
  return c > 0 ? `${a}-${b}-${c}` : `${a}-${b}`
}
