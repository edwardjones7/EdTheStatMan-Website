/**
 * What the public pick pages may show, built field by field.
 *
 * The rows are read with select('*') through the service role, so every row
 * arrives with its bet, line and note, members' picks included. NOTHING FROM A
 * LOCKED ROW IS SPREAD into what a page renders: a members' pick becomes a
 * PublicPick with bet / line / opponent / note / odds nulled until it is
 * graded. That is the house rule in lib/gate.ts (locked rows are dropped or
 * redacted server-side, never sent and hidden with CSS), applied to a page
 * that is cached and served to everyone.
 *
 * Reveal-on-grade is deliberate (the public ledger): once a game is over, the
 * pick is history and the record is only believable if every graded pick can
 * be read.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { selectAll } from '@/lib/supabase/select-all'
import { rowMinTier } from '@/lib/gate'
import { nyToday } from '@/lib/brief'
import { oddsOf, type RecordSource } from '@/lib/records'
import { isUuid } from './slug'
import { hasPickEngineColumns } from './columns'

export type PickResult = 'pending' | 'win' | 'loss' | 'push'

export interface PublicPick {
  id: string
  /** The path segment: the slug when the pick has one, otherwise the id. */
  key: string
  date: string | null
  sport: string
  free: boolean
  /** Bet and friends are null on a members' pick that has not been graded. */
  locked: boolean
  bet: string | null
  opponent: string | null
  odds: number | null
  market: string | null
  note: string | null
  result: PickResult
  postedAt: string | null
  updatedAt: string | null
  xPostId: string | null
  source: string | null
}

function resultOf(value: unknown): PickResult {
  const r = String(value ?? '').toLowerCase()
  return r === 'win' || r === 'loss' || r === 'push' ? r : 'pending'
}

/** Has this pick been graded? Graded members' picks are revealed. */
export function isGraded(result: PickResult): boolean {
  return result !== 'pending'
}

/** Is this row public at all? A pick saved inactive and never published is still a draft. */
function isPublishable(row: any): boolean {
  return row.is_active !== false || row.show_on_results === true
}

export function toPublicPick(row: any): PublicPick {
  const free = rowMinTier(row, 'portfolio') === 'retail'
  const result = resultOf(row.result)
  // Revealed only once graded AND on the published ledger: a members' pick Ed
  // has kept off the results page stays his members' business.
  const locked = !free && !(isGraded(result) && row.show_on_results === true)
  const odds = oddsOf({ odds: row.odds ?? null, line: row.line ?? null })
  return {
    id: String(row.id),
    key: row.slug || String(row.id),
    date: row.date ?? null,
    sport: String(row.sport ?? '').toUpperCase() || 'PICK',
    free,
    locked,
    bet: locked ? null : row.bet ?? null,
    opponent: locked ? null : row.opponent ?? null,
    odds: locked ? null : odds,
    market: locked ? null : row.market ?? null,
    note: locked ? null : row.note ?? null,
    result,
    postedAt: row.posted_at ?? row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    xPostId: row.x_post_id ?? null,
    source: row.source ?? null,
  }
}

export interface PicksData {
  /** Every row, raw, for lib/records.ts. Server only -- never pass to a client component. */
  records: RecordSource[]
  upcomingFree: PublicPick[]
  recentFree: PublicPick[]
  /** Members' picks on today's and later cards, locked. Count only, for the upsell. */
  upcomingMembers: number
  today: string
}

export async function loadPicksData(now: Date = new Date()): Promise<PicksData> {
  const admin = createAdminClient() as any
  const { data } = await selectAll(() => admin
    .from('todays_bets')
    .select('*')
    .order('date', { ascending: false, nullsFirst: false })
    .order('id'))
  const rows = (data ?? []).filter(isPublishable)

  const today = nyToday(now)
  // Yesterday too: a late game posted last night is still waiting on a grade
  // this morning, and dropping it would make an open pick look withdrawn.
  const yesterday = nyToday(new Date(now.getTime() - 864e5))

  const upcomingFree: PublicPick[] = []
  const recentFree: PublicPick[] = []
  let upcomingMembers = 0

  for (const row of rows) {
    const pick = toPublicPick(row)
    const open = pick.result === 'pending' && row.is_active !== false && !!pick.date && pick.date >= yesterday
    if (pick.free) {
      if (open) upcomingFree.push(pick)
      else if (isGraded(pick.result) && row.show_on_results === true) recentFree.push(pick)
    } else if (open) {
      upcomingMembers++
    }
  }

  upcomingFree.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || (a.postedAt ?? '').localeCompare(b.postedAt ?? ''))

  return {
    records: rows as RecordSource[],
    upcomingFree,
    recentFree: recentFree.slice(0, 25),
    upcomingMembers,
    today,
  }
}

/**
 * One pick by its path segment: the slug, or the id (before the migration, and
 * for any link minted from an id). Returns the raw row's public view and the
 * slug it should canonically live at.
 */
export async function loadPick(key: string): Promise<{ pick: PublicPick; canonicalKey: string } | null> {
  const admin = createAdminClient() as any
  const engine = await hasPickEngineColumns(admin)

  let row: any = null
  if (engine) {
    const { data } = await admin.from('todays_bets').select('*').eq('slug', key).maybeSingle()
    row = data
  }
  if (!row && isUuid(key)) {
    const { data } = await admin.from('todays_bets').select('*').eq('id', key).maybeSingle()
    row = data
  }
  if (!row || !isPublishable(row)) return null

  const pick = toPublicPick(row)
  return { pick, canonicalKey: pick.key }
}

/** "Chiefs -3.5 (-110)" for a free or graded pick; "Members' pick" otherwise. */
export function pickHeadline(p: PublicPick): string {
  if (p.locked || !p.bet) return `${p.sport} members' pick`
  return p.bet
}
