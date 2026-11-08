/**
 * The public records, computed one way for every surface that shows them.
 *
 * Two books, kept apart on purpose (vault Decisions 2026-10-15):
 *   - "free"     picks Ed gives away (todays_bets.is_free), X picks included
 *   - "members"  the paid card
 * Heavy free prop volume must not move the members' headline, and showing the
 * two side by side is the upgrade argument -- which only holds while the
 * members' book really is the better one, so nothing here hides either.
 *
 * Only rows flagged show_on_results count, the same rule as publishedRecord()
 * in lib/brief.ts.
 *
 * UNITS. One unit risked per pick. A win at American odds `o` returns o/100
 * units when o > 0 and 100/|o| when o < 0; a loss costs 1; a push is 0. When a
 * pick has no recorded price it is graded at -110, and `assumedOdds` counts
 * how many, so every surface can say so. Posted odds come from the `odds`
 * column (picks_01_engine.sql) when present, otherwise from `line` only when
 * `line` is unmistakably a price ("-115", "+130") rather than a spread.
 */

export type Book = 'free' | 'members'

export interface RecordSource {
  date: string | null
  sport: string | null
  line: string | null
  result: string | null
  is_free?: boolean | null
  show_on_results?: boolean | null
  /** American odds at posting, when recorded (picks_01_engine.sql). */
  odds?: number | null
}

export interface PickRecord {
  w: number
  l: number
  p: number
  /** Decisions only; pushes excluded. 0 when there are no decisions. */
  pct: number
  units: number
  /** Units won per unit risked, as a percent. */
  roi: number
  /** Graded picks that had no recorded price and were scored at -110. */
  assumedOdds: number
  /** First and last graded dates (YYYY-MM-DD), for "since ..." lines. */
  from: string | null
  to: string | null
}

export const DEFAULT_ODDS = -110
/** Win rate needed to break even at -110. */
export const BREAK_EVEN_PCT = 52.38
/** Fewer decisions than this and a sport's record is noise, not a result. */
export const MIN_DECISIONS = 5

const EMPTY: PickRecord = { w: 0, l: 0, p: 0, pct: 0, units: 0, roi: 0, assumedOdds: 0, from: null, to: null }

/** A price, or null. Only reads `line` when it cannot be a spread or total. */
export function oddsOf(row: Pick<RecordSource, 'odds' | 'line'>): number | null {
  if (typeof row.odds === 'number' && Number.isFinite(row.odds) && Math.abs(row.odds) >= 100) {
    return Math.round(row.odds)
  }
  const m = String(row.line ?? '').trim().match(/^([+-]\d{3,4})$/)
  if (!m) return null
  const n = Number(m[1])
  return Math.abs(n) >= 100 ? n : null
}

export function unitsFor(result: string, odds: number): number {
  if (result === 'win') return odds > 0 ? odds / 100 : 100 / Math.abs(odds)
  if (result === 'loss') return -1
  return 0
}

function gradedOnly(rows: RecordSource[]): (RecordSource & { r: string })[] {
  const out: (RecordSource & { r: string })[] = []
  for (const row of rows) {
    if (row.show_on_results !== true) continue
    const r = String(row.result ?? '').toLowerCase()
    if (r === 'win' || r === 'loss' || r === 'push') out.push({ ...row, r })
  }
  return out
}

export function computeRecord(rows: RecordSource[]): PickRecord {
  const graded = gradedOnly(rows)
  if (graded.length === 0) return { ...EMPTY }
  let w = 0, l = 0, p = 0, units = 0, assumed = 0, risked = 0
  let from: string | null = null, to: string | null = null
  for (const g of graded) {
    if (g.r === 'win') w++
    else if (g.r === 'loss') l++
    else p++
    const price = oddsOf(g)
    if (price === null) assumed++
    units += unitsFor(g.r, price ?? DEFAULT_ODDS)
    if (g.r !== 'push') risked++
    if (g.date) {
      if (!from || g.date < from) from = g.date
      if (!to || g.date > to) to = g.date
    }
  }
  const decisions = w + l
  return {
    w, l, p,
    pct: decisions ? (w / decisions) * 100 : 0,
    units: Math.round(units * 100) / 100,
    roi: risked ? Math.round((units / risked) * 1000) / 10 : 0,
    assumedOdds: assumed,
    from, to,
  }
}

export function bookOf(row: Pick<RecordSource, 'is_free'>): Book {
  return row.is_free ? 'free' : 'members'
}

export function recordsByBook(rows: RecordSource[]): { [K in Book]: PickRecord } {
  return {
    free: computeRecord(rows.filter(r => bookOf(r) === 'free')),
    members: computeRecord(rows.filter(r => bookOf(r) === 'members')),
  }
}

export interface SportRecord extends PickRecord {
  sport: string
}

/** Per-sport records, largest sample first, under-sampled sports dropped. */
export function recordsBySport(rows: RecordSource[], minDecisions = MIN_DECISIONS): SportRecord[] {
  const by = new Map<string, RecordSource[]>()
  for (const r of rows) {
    const s = String(r.sport ?? '').trim().toUpperCase()
    if (!s) continue
    if (!by.has(s)) by.set(s, [])
    by.get(s)!.push(r)
  }
  return [...by.entries()]
    .map(([sport, rs]) => ({ sport, ...computeRecord(rs) }))
    .filter(r => r.w + r.l >= minDecisions)
    .sort((a, b) => (b.w + b.l) - (a.w + a.l))
}

/** Sports whose season straddles New Year and is named "2025-26". */
const SPLIT_YEAR = new Set(['NBA', 'NHL', 'CBB', 'NCAAB', 'NCAABB'])
/** Sports played Aug/Sep to Jan/Feb, named by the year they start. */
const FALL_YEAR = new Set(['NFL', 'CFB', 'NCAAF'])

/**
 * The season a pick belongs to, from its sport and YYYY-MM-DD date.
 *   NBA/NHL/CBB  Aug onward starts the next season: 2026-04-14 -> "2025-26"
 *   NFL/CFB      Jan-Feb belong to the previous fall: 2027-01-10 -> "2026"
 *   everything else (WNBA, CFL, MLB...)  the calendar year
 * Returns null when the date is not a full ISO date.
 */
export function seasonOf(sport: string | null, date: string | null): string | null {
  const m = String(date ?? '').match(/^(\d{4})-(\d{2})-\d{2}/)
  if (!m) return null
  const y = Number(m[1]), mo = Number(m[2])
  const s = String(sport ?? '').trim().toUpperCase()
  if (SPLIT_YEAR.has(s)) {
    const start = mo >= 8 ? y : y - 1
    return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
  }
  if (FALL_YEAR.has(s)) return String(mo <= 2 ? y - 1 : y)
  return String(y)
}

export interface SeasonRecord extends PickRecord {
  season: string
}

export interface SportBreakdown extends SportRecord {
  /** Newest season first. */
  seasons: SeasonRecord[]
}

/**
 * Every sport with at least one graded pick (no sample floor: this is the full
 * breakdown, not a headline), largest sample first, each split by season.
 */
export function sportSeasonBreakdown(rows: RecordSource[]): SportBreakdown[] {
  const by = new Map<string, RecordSource[]>()
  for (const r of rows) {
    const s = String(r.sport ?? '').trim().toUpperCase()
    if (!s) continue
    if (!by.has(s)) by.set(s, [])
    by.get(s)!.push(r)
  }
  const out: SportBreakdown[] = []
  for (const [sport, rs] of by) {
    const rec = computeRecord(rs)
    if (rec.w + rec.l + rec.p === 0) continue
    const seasons = new Map<string, RecordSource[]>()
    for (const r of rs) {
      const key = seasonOf(sport, r.date) ?? 'Undated'
      if (!seasons.has(key)) seasons.set(key, [])
      seasons.get(key)!.push(r)
    }
    out.push({
      sport,
      ...rec,
      seasons: [...seasons.entries()]
        .map(([season, srs]) => ({ season, ...computeRecord(srs) }))
        .filter(x => x.w + x.l + x.p > 0)
        .sort((a, b) => (a.season === 'Undated' ? 1 : b.season === 'Undated' ? -1 : b.season.localeCompare(a.season))),
    })
  }
  return out.sort((a, b) => (b.w + b.l + b.p) - (a.w + a.l + a.p))
}

/**
 * The headline: the strongest sport with a real sample that is in season now
 * (graded in the last `recentDays`), falling back to the strongest overall.
 * Honest only because the full ledger is one click away on every surface that
 * shows it -- never render this without that link.
 */
export function headlineRecord(
  rows: RecordSource[],
  opts: { now?: Date; recentDays?: number; minDecisions?: number } = {}
): SportRecord | null {
  const { now = new Date(), recentDays = 45, minDecisions = 8 } = opts
  const cutoff = new Date(now.getTime() - recentDays * 864e5).toISOString().slice(0, 10)
  const sports = recordsBySport(rows, minDecisions)
  const inSeason = sports.filter(s => s.to && s.to >= cutoff)
  const pool = inSeason.length ? inSeason : sports
  if (pool.length === 0) return null
  return [...pool].sort((a, b) => b.pct - a.pct || (b.w + b.l) - (a.w + a.l))[0]
}

export function formatRecord(r: Pick<PickRecord, 'w' | 'l' | 'p'>): string {
  return r.p ? `${r.w}-${r.l}-${r.p}` : `${r.w}-${r.l}`
}

export function formatUnits(u: number): string {
  return `${u > 0 ? '+' : ''}${u.toFixed(1)}u`
}
