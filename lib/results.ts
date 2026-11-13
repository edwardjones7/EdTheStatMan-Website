// Shapes for /portfolio/performance: running-units series and the monthly
// calendar. Pure, over rows already in hand, and on the same lib/records.ts
// maths (unitsFor at the recorded price, -110 when none) as every other number
// on the page, so the charts always end on the totals printed beside them.

import { oddsOf, unitsFor, DEFAULT_ODDS, type RecordSource } from './records'

type Graded = 'win' | 'loss' | 'push'

function gradeOf(r: RecordSource): Graded | null {
  const g = String(r.result ?? '').toLowerCase()
  return g === 'win' || g === 'loss' || g === 'push' ? g : null
}

export function unitsOf(r: RecordSource): number {
  const g = gradeOf(r)
  return g ? unitsFor(g, oddsOf(r) ?? DEFAULT_ODDS) : 0
}

const ISO = /^\d{4}-\d{2}-\d{2}/

/** Oldest first. Free-text dates ("Mar 19") fall back to created_at. */
function timeOf(r: RecordSource & { created_at?: string | null }): number {
  if (r.date && ISO.test(r.date)) {
    const t = Date.parse(r.date.slice(0, 10))
    if (!Number.isNaN(t)) return t
  }
  const c = Date.parse(String(r.created_at ?? ''))
  return Number.isNaN(c) ? 0 : c
}

export interface UnitsSeries {
  points: number[]
  first: string | null
  last: string | null
}

/** Running units over these rows' graded, published picks, oldest first. */
export function unitsSeries(rows: (RecordSource & { created_at?: string | null })[]): UnitsSeries {
  const graded = rows
    .filter(r => r.show_on_results === true && gradeOf(r))
    .map(r => ({ r, t: timeOf(r) }))
    .sort((a, b) => a.t - b.t)
  let u = 0
  const points = graded.map(({ r }) => {
    u += unitsOf(r)
    return Math.round(u * 100) / 100
  })
  const iso = (t: number) => (t ? new Date(t).toISOString().slice(0, 10) : null)
  return {
    points: points.length ? [0, ...points] : [],
    first: graded.length ? iso(graded[0].t) : null,
    last: graded.length ? iso(graded[graded.length - 1].t) : null,
  }
}

export interface CalendarDay {
  /** YYYY-MM-DD */
  date: string
  day: number
  w: number
  l: number
  p: number
  units: number
}

export interface CalendarMonth {
  /** YYYY-MM */
  month: string
  label: string
  /** Blank cells before day 1 (Sunday-first week). */
  lead: number
  days: CalendarDay[]
  prev: string
  next: string
  totals: { w: number; l: number; p: number; units: number }
}

/** "2026-11", from a query value when it is a real month, else `fallback`. */
export function parseMonth(q: string | undefined, fallback: string): string {
  if (q && /^\d{4}-(0[1-9]|1[0-2])$/.test(q)) return q
  return fallback
}

function shift(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + by, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Per-day results for one month. Only rows with a full ISO date can be placed. */
export function calendarMonth(rows: RecordSource[], month: string): CalendarMonth {
  const [y, m] = month.split('-').map(Number)
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const days: CalendarDay[] = Array.from({ length: daysIn }, (_, i) => ({
    date: `${month}-${String(i + 1).padStart(2, '0')}`,
    day: i + 1, w: 0, l: 0, p: 0, units: 0,
  }))
  const totals = { w: 0, l: 0, p: 0, units: 0 }
  for (const r of rows) {
    if (r.show_on_results !== true || !r.date || !r.date.startsWith(`${month}-`)) continue
    const g = gradeOf(r)
    if (!g) continue
    const d = days[Number(r.date.slice(8, 10)) - 1]
    if (!d) continue
    const u = unitsOf(r)
    if (g === 'win') { d.w++; totals.w++ } else if (g === 'loss') { d.l++; totals.l++ } else { d.p++; totals.p++ }
    d.units += u
    totals.units += u
  }
  for (const d of days) d.units = Math.round(d.units * 100) / 100
  totals.units = Math.round(totals.units * 100) / 100
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { month, label, lead, days, prev: shift(month, -1), next: shift(month, 1), totals }
}
