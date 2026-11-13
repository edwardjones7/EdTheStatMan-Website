// The Portfolio card, assembled once and gated on the server.
//
// HOUSE RULE, the same as lib/teaser.ts and lib/brief.ts: a locked pick is
// never sent to the browser. Visible picks are copied FIELD BY FIELD (todays_bets
// is read with select('*'), so a spread would ship every current and future
// column), and a locked pick becomes a stand-in that carries only its sport and,
// when it is linked to a Desk game, that game's teams and kickoff. The Desk
// already shows per-game bet counts publicly, so "Ed has a play on WSH @ NYG"
// gives nothing away; the side, the number, the price and the note stay here.
//
// Pure: no database, so the gate can be read and tested without one.

import { nyToday } from './brief'

/** The columns this module reads. Rows carry more; it never touches them. */
export interface PortfolioSource {
  id: string
  date: string | null
  sport: string | null
  bet: string | null
  line: string | null
  vig: string | null
  opponent: string | null
  note: string | null
  result: string | null
  is_active?: boolean | null
  is_free?: boolean | null
  show_on_results?: boolean | null
  created_at?: string | null
  odds?: number | null
  game_id?: string | null
}

/** The public facts about a Desk game. Nothing about any pick on it. */
export interface PortfolioGame {
  id: string
  sport: string
  away: string
  home: string
  kickoff: string | null
  status: string | null
  awayScore: number | null
  homeScore: number | null
  href: string | null
}

/** A pick this visitor may see. Exactly what the card renders. */
export interface VisiblePick {
  kind: 'visible'
  id: string
  date: string | null
  sport: string
  bet: string
  line: string | null
  vig: string | null
  opponent: string | null
  note: string | null
  result: 'win' | 'loss' | 'push' | null
  isFree: boolean
  game: PortfolioGame | null
}

/** A pick this visitor may NOT see: sport and game only, never the play. */
export interface LockedPick {
  kind: 'locked'
  /** Positional, not the row id: the id is not needed and says nothing useful. */
  key: string
  sport: string
  game: PortfolioGame | null
}

export type CardPick = VisiblePick | LockedPick

export interface CardDay {
  date: string
  isToday: boolean
  picks: CardPick[]
}

export interface HistoryPick {
  id: string
  date: string | null
  sport: string
  bet: string
  line: string | null
  result: 'win' | 'loss' | 'push'
  units: number
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const GRADED = new Set(['win', 'loss', 'push'])

function gradeOf(r: string | null): 'win' | 'loss' | 'push' | null {
  const g = String(r ?? '').toLowerCase()
  return GRADED.has(g) ? (g as 'win' | 'loss' | 'push') : null
}

function sportOf(s: string | null): string {
  return (s ?? '').trim().toUpperCase() || 'OTHER'
}

/**
 * Which days make up the current card: every day from today on that has an
 * active pick (picks go up the night before, so tomorrow belongs with today),
 * or, when nothing is ahead, the most recent day that had one.
 */
export function cardDates(rows: PortfolioSource[], today: string): string[] {
  const dates = Array.from(new Set(
    rows.filter(r => r.is_active !== false && r.date && ISO.test(r.date)).map(r => r.date as string)
  )).sort()
  if (dates.length === 0) return []
  const ahead = dates.filter(d => d >= today)
  return ahead.length ? ahead.slice(0, 3) : [dates[dates.length - 1]]
}

export function buildCard(
  rows: PortfolioSource[],
  canSee: (r: PortfolioSource) => boolean,
  games: Map<string, PortfolioGame>,
  now: Date = new Date(),
): CardDay[] {
  const today = nyToday(now)
  return cardDates(rows, today).map(date => {
    const slate = rows
      .filter(r => r.date === date && r.is_active !== false)
      .sort((a, b) => String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')))
    let n = 0
    const picks: CardPick[] = slate.map(row => {
      const game = row.game_id ? games.get(row.game_id) ?? null : null
      if (canSee(row)) {
        // Field by field. Never spread -- see the header.
        return {
          kind: 'visible',
          id: row.id,
          date: row.date,
          sport: sportOf(row.sport),
          bet: row.bet ?? '',
          line: row.line,
          vig: row.vig,
          opponent: row.opponent,
          note: row.note,
          result: gradeOf(row.result),
          isFree: !!row.is_free,
          game,
        }
      }
      n++
      return { kind: 'locked', key: `${date}-${n}`, sport: sportOf(row.sport), game }
    })
    // Visible first, then the locked stand-ins, so the card reads top-down as
    // "what you have" then "what you are missing".
    picks.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'visible' ? -1 : 1))
    return { date, isToday: date === today, picks }
  })
}

/**
 * Recent graded picks this visitor can see, newest first. Same gate as the
 * card: a pick the visitor cannot see is not in the history either.
 */
export function buildHistory(
  rows: PortfolioSource[],
  canSee: (r: PortfolioSource) => boolean,
  unitsOf: (r: PortfolioSource) => number,
  n = 15,
): HistoryPick[] {
  return rows
    .filter(r => r.show_on_results === true && gradeOf(r.result) && canSee(r))
    .sort((a, b) =>
      String(b.date ?? '').localeCompare(String(a.date ?? '')) ||
      String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
    )
    .slice(0, n)
    .map(r => ({
      id: r.id,
      date: r.date,
      sport: sportOf(r.sport),
      bet: r.bet ?? '',
      line: r.line,
      result: gradeOf(r.result)!,
      units: Math.round(unitsOf(r) * 100) / 100,
    }))
}

/** "Thu, Nov 12" */
export function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}
