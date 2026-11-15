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
 * UNITS. Flat, whatever the price: a win is +1u, a loss is -1.1u, a push is 0
 * (risk 1.1 to win 1, the standard -110 bet). Ed can set his own amounts on a
 * pick in the editor (todays_bets.risk / todays_bets.win, units, free text so
 * "2" and "2u" both read), and a pick that carries them is graded on them
 * instead; `customStakes` counts how many, so every surface can say so. Posted
 * odds (oddsOf) are display only and never move the units.
 */

export type Book = 'free' | 'members'

export interface RecordSource {
  date: string | null
  sport: string | null
  line: string | null
  result: string | null
  is_free?: boolean | null
  show_on_results?: boolean | null
  /** American odds at posting, when recorded (picks_01_engine.sql). Display only. */
  odds?: number | null
  /** Units risked on this pick, as typed in the editor. Blank means 1.1. */
  risk?: string | number | null
  /** Units this pick wins, as typed in the editor. Blank means 1. */
  win?: string | number | null
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
  /** Graded picks scored on amounts Ed entered rather than the flat 1.1 / 1. */
  customStakes: number
  /** First and last graded dates (YYYY-MM-DD), for "since ..." lines. */
  from: string | null
  to: string | null
}

/** Units a pick risks, and wins, when the editor leaves them blank. */
export const DEFAULT_RISK = 1.1
export const DEFAULT_WIN = 1
/** Win rate needed to break even risking 1.1 to win 1 (the -110 price). */
export const BREAK_EVEN_PCT = 52.38
/** Fewer decisions than this and a sport's record is noise, not a result. */
export const MIN_DECISIONS = 5

const EMPTY: PickRecord = { w: 0, l: 0, p: 0, pct: 0, units: 0, roi: 0, customStakes: 0, from: null, to: null }

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

/** A unit amount as typed ("1.1", "2u", "1.5 units"), or null when blank or unreadable. */
export function unitAmount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 && v <= 100 ? v : null
  const m = String(v ?? '').trim().match(/^\+?(\d+(?:\.\d+)?|\.\d+)\s*(?:u|units?)?$/i)
  if (!m) return null
  const n = Number(m[1])
  return n > 0 && n <= 100 ? n : null
}

export interface Stake {
  risk: number
  win: number
  /** True when either amount came from the pick rather than the default. */
  custom: boolean
}

/** What a pick risks and wins, in units: the editor's amounts, else 1.1 / 1. */
export function stakeOf(row: Pick<RecordSource, 'risk' | 'win'>): Stake {
  const risk = unitAmount(row.risk)
  const win = unitAmount(row.win)
  return { risk: risk ?? DEFAULT_RISK, win: win ?? DEFAULT_WIN, custom: risk !== null || win !== null }
}

/** Units a graded pick returned: +win, -risk, or 0 for a push or anything ungraded. */
export function unitsFor(result: string, row: Pick<RecordSource, 'risk' | 'win'> = {}): number {
  const r = String(result).toLowerCase()
  if (r !== 'win' && r !== 'loss') return 0
  const st = stakeOf(row)
  return r === 'win' ? st.win : -st.risk
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
  let w = 0, l = 0, p = 0, units = 0, custom = 0, risked = 0
  let from: string | null = null, to: string | null = null
  for (const g of graded) {
    if (g.r === 'win') w++
    else if (g.r === 'loss') l++
    else p++
    const st = stakeOf(g)
    if (st.custom) custom++
    units += unitsFor(g.r, g)
    if (g.r !== 'push') risked += st.risk
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
    customStakes: custom,
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
