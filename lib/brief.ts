// Today's Brief — the daily card, assembled once.
//
// Pure module, no imports beyond the access ladder, for the same reason
// lib/access.ts is: the homepage resolves entitlement already and passes it in,
// and keeping this side-effect free means the gating can be reasoned about
// without a database.
//
// HOUSE RULE, preserved from lib/teaser.ts: locked picks are DROPPED here and
// advertised only as a count. Visible picks are copied FIELD BY FIELD rather
// than spread — todays_bets is queried with select('*'), so a spread would ship
// every current and future column (risk, note, internal flags) to the browser.

import { atLeastTier, type Tier } from './access'
import { rowMinTier } from './gate'

/** The columns the brief reads. Rows carry more; we never touch it. */
export interface BriefSource {
  id: string
  date: string | null
  sport: string | null
  bet: string | null
  line: string | null
  opponent: string | null
  result: string | null
  is_active?: boolean | null
  is_free?: boolean | null
  is_elite?: boolean | null
  min_tier?: string | null
  show_on_results?: boolean | null
}

/** Exactly what a card renders. Nothing else crosses the wire. */
export interface BriefPick {
  id: string
  sport: string
  bet: string
  line: string | null
  opponent: string | null
  result: string | null
}

export interface BriefRecord {
  w: number
  l: number
  p: number
  /** Win rate over decisions only — pushes are excluded, as they should be. */
  pct: number
}

export interface Brief {
  /** ISO date of the card being shown, or null when there is nothing to show. */
  date: string | null
  /** True when `date` is today in New York. */
  isToday: boolean
  /** Picks this member may actually see. */
  visible: BriefPick[]
  /** How many picks on this card are locked to them. */
  lockedCount: number
  /** Every pick on the card, locked included, counted by sport. */
  sportCounts: { sport: string; n: number }[]
  /** Size of the whole card, locked included. */
  total: number
  /** The published record, or null when nothing is graded yet. */
  record: BriefRecord | null
}

/**
 * Today's date in New York as YYYY-MM-DD.
 *
 * The whole app treats New York as the operating day — analytics buckets and
 * the AI quota key both do — and a card must not flip over at UTC midnight,
 * which is 8pm the previous evening in Ed's timezone.
 */
export function nyToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is the shape todays_bets.date stores.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now)
}

/**
 * Which card to show.
 *
 * Prefers today, then the soonest upcoming day, then the most recent past day.
 * Falling forward matters more than falling back: picks are posted the night
 * before, so "nothing today" should surface tomorrow's card rather than an
 * empty block or a stale result.
 */
export function selectSlateDate(rows: BriefSource[], today: string): string | null {
  const dates = Array.from(
    new Set(rows.filter(r => r.is_active !== false && r.date).map(r => r.date as string))
  ).sort()
  if (dates.length === 0) return null

  return dates.find(d => d >= today) ?? dates[dates.length - 1]
}

/** The published record. Only rows Ed has flagged for the public results page. */
export function publishedRecord(rows: BriefSource[]): BriefRecord | null {
  let w = 0, l = 0, p = 0
  for (const r of rows) {
    if (r.show_on_results !== true) continue
    switch (String(r.result ?? '').toLowerCase()) {
      case 'win': w++; break
      case 'loss': l++; break
      case 'push': p++; break
    }
  }
  const decisions = w + l
  if (decisions === 0) return null
  return { w, l, p, pct: (w / decisions) * 100 }
}

/**
 * Assemble the brief for one member.
 *
 * `paidDefault` is 'portfolio' because the picks ARE the Portfolio product —
 * the same default app/portfolio/page.tsx passes to rowMinTier().
 */
export function buildBrief(
  rows: BriefSource[],
  userTier: Tier | null,
  isAdmin: boolean,
  now: Date = new Date()
): Brief {
  const today = nyToday(now)
  const date = selectSlateDate(rows, today)
  const record = publishedRecord(rows)

  if (!date) {
    return { date: null, isToday: false, visible: [], lockedCount: 0, sportCounts: [], total: 0, record }
  }

  const slate = rows.filter(r => r.date === date && r.is_active !== false)

  const visible: BriefPick[] = []
  let lockedCount = 0
  const bySport = new Map<string, number>()

  for (const row of slate) {
    const sport = (row.sport ?? '').toUpperCase() || 'OTHER'
    bySport.set(sport, (bySport.get(sport) ?? 0) + 1)

    if (isAdmin || atLeastTier(userTier, rowMinTier(row as any, 'portfolio'))) {
      // Field by field. Never spread — see the header.
      visible.push({
        id: row.id,
        sport,
        bet: row.bet ?? '',
        line: row.line,
        opponent: row.opponent,
        result: row.result,
      })
    } else {
      lockedCount++
    }
  }

  const sportCounts = Array.from(bySport, ([sport, n]) => ({ sport, n }))
    .sort((a, b) => b.n - a.n || a.sport.localeCompare(b.sport))

  return {
    date,
    isToday: date === today,
    visible,
    lockedCount,
    sportCounts,
    total: slate.length,
    record,
  }
}

/** "Thursday, September 4" for the card headline. */
export function formatCardDate(date: string): string {
  // Parse as noon UTC so the date never slips a day when re-projected to NY.
  const d = new Date(`${date}T12:00:00Z`)
  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York',
  })
}

/** "Today", "Tomorrow", or the weekday — the small eyebrow above the date. */
export function relativeLabel(date: string, now: Date = new Date()): string {
  const today = nyToday(now)
  if (date === today) return 'Today'
  const tomorrow = nyToday(new Date(now.getTime() + 24 * 60 * 60 * 1000))
  if (date === tomorrow) return 'Tomorrow'
  return date > today ? 'Next card' : 'Latest card'
}
