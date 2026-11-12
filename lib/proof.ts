// The proof block: what the homepage, /win, the empty Portfolio and the
// results page all say about the record, assembled once.
//
// Every number comes from lib/records.ts. This module only chooses WHICH of
// those numbers to lead with and shapes them for rendering, so a surface can
// never compute its own (the homepage used to: a blended 51.2% across both
// books, under break-even, as the first number a visitor saw).
//
// Which book leads: the members' card, because that is what /win sells. The
// free book is always returned beside it and every surface shows both -- the
// side-by-side is the upgrade argument, and it only stays honest while neither
// can be hidden (vault Decisions 2026-10-15).

import { createCachedClient, DB_TAGS } from './supabase/cached'
import { selectAll } from './supabase/select-all'
import {
  recordsByBook,
  recordsBySport,
  headlineRecord,
  bookOf,
  formatRecord,
  formatUnits,
  BREAK_EVEN_PCT,
  type Book,
  type PickRecord,
  type RecordSource,
  type SportRecord,
} from './records'

export interface ProofStat {
  /** "19-8-3" */
  record: string
  w: number
  l: number
  p: number
  pct: number
  /** "+9.4u" */
  units: string
  unitsValue: number
  assumedOdds: number
  graded: number
  from: string | null
  to: string | null
  beatsBreakEven: boolean
}

export interface ProofSport extends ProofStat {
  sport: string
}

export interface ProofData {
  /** Best in-season sport with a real sample, from `headlineBook`. */
  headline: ProofSport | null
  /** The book the headline and the chips were computed from. */
  headlineBook: Book
  /** False when headlineRecord() fell back to the best sport overall because
   *  nothing in this book was graded recently. The label must say which. */
  headlineInSeason: boolean
  /** Per-sport splits of the same book, largest sample first. Not cherry-picked. */
  sports: ProofSport[]
  books: { [K in Book]: ProofStat | null }
}

/** "In season" means graded within this many days (headlineRecord's default). */
const HEADLINE_RECENT_DAYS = 45

function stat(r: PickRecord): ProofStat {
  return {
    record: formatRecord(r),
    w: r.w, l: r.l, p: r.p,
    pct: r.pct,
    units: formatUnits(r.units),
    unitsValue: r.units,
    assumedOdds: r.assumedOdds,
    graded: r.w + r.l + r.p,
    from: r.from,
    to: r.to,
    beatsBreakEven: r.pct >= BREAK_EVEN_PCT,
  }
}

function sportStat(s: SportRecord): ProofSport {
  return { sport: s.sport, ...stat(s) }
}

/** Pure: build the proof from rows already in hand (the results page has them). */
export function buildProof(rows: RecordSource[], now: Date = new Date()): ProofData {
  const books = recordsByBook(rows)
  const members = rows.filter(r => bookOf(r) === 'members')

  // Lead with the members' card. Fall back to the free book only when the paid
  // card has no sport with a real sample yet, and say so through headlineBook
  // rather than letting a free-pick stretch pass as the product's record.
  let headlineBook: Book = 'members'
  let pool = members
  let head = headlineRecord(pool, { now, recentDays: HEADLINE_RECENT_DAYS })
  if (!head) {
    const free = rows.filter(r => bookOf(r) === 'free')
    const freeHead = headlineRecord(free, { now, recentDays: HEADLINE_RECENT_DAYS })
    if (freeHead) {
      headlineBook = 'free'
      pool = free
      head = freeHead
    }
  }

  // Same window headlineRecord() uses by default.
  const cutoff = new Date(now.getTime() - HEADLINE_RECENT_DAYS * 864e5).toISOString().slice(0, 10)

  return {
    headline: head ? sportStat(head) : null,
    headlineBook,
    headlineInSeason: !!head?.to && head.to >= cutoff,
    sports: recordsBySport(pool).map(sportStat),
    books: {
      members: books.members.w + books.members.l + books.members.p ? stat(books.members) : null,
      free: books.free.w + books.free.l + books.free.p ? stat(books.free) : null,
    },
  }
}

/**
 * Every published pick, read through the admin client for the same reason the
 * Portfolio page does (the app's tier logic is the gate, not RLS; the record is
 * public anyway). select('*') rather than a column list because `odds` only
 * exists once picks_01_engine.sql is applied, and naming a missing column
 * fails the whole read. Only the shaped ProofData leaves the server.
 */
export async function loadPublishedPicks<T extends RecordSource = RecordSource>(): Promise<T[]> {
  // Cached: the homepage and /portfolio/performance read this on every visit.
  const admin = createCachedClient([DB_TAGS.picks]) as any
  const { data, error } = await selectAll<T>(() =>
    admin.from('todays_bets').select('*').eq('show_on_results', true).order('id', { ascending: true })
  )
  if (error) console.error(`[proof] todays_bets read failed: ${error.message}`)
  return data
}

export async function loadProof(): Promise<ProofData> {
  return buildProof(await loadPublishedPicks())
}

/** "Sep 4" for "since ..." lines. Dates are stored as YYYY-MM-DD. */
export function shortDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export const BOOK_LABEL: Record<Book, string> = {
  members: "Members' card",
  free: 'Free picks',
}
