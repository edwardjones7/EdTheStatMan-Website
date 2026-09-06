// Content gating for the v3 ladder.
//
// This module is the one place that decides which rows a member may see and how
// the rest are advertised. app/betting-systems/page.tsx and
// app/betting-trends/page.tsx previously carried near-byte-identical copies of
// this logic; both now call partitionBySport().
//
// MIGRATION TOLERANT ON PURPOSE. rowMinTier() reads the new `min_tier` column
// when it exists and falls back to the legacy is_free / is_elite booleans when
// it does not, so the application runs correctly both before and after
// tier_ladder_02_content_min_tier.sql is applied. Same idea as normalizeTier()
// in lib/access.ts: never require the code deploy and the SQL to be simultaneous.
//
// HOUSE RULE, preserved: locked rows are DROPPED server-side and advertised as
// a count plus a record-only teaser. They are never sent and CSS-blurred, and
// teasers are built field by field by toTeaser() because the source tables are
// queried with select('*') — a spread would ship every current and future column.

import { TIER_RANK, atLeastTier, normalizeTier, type Tier } from './access'
import { compareCode } from './codes'
import { toTeaser, TEASER_LIMIT_PER_SPORT, type LockedTeaser } from './teaser'

/** The columns gating actually reads. Rows carry far more; we never touch it. */
export interface GatedRow {
  id: string
  /** The Vault's business key (CFBS0001). Absent until vault_01 is applied. */
  code?: string | null
  sport: string
  w: number | null
  l: number | null
  t: number | null
  pct: number | null
  min_tier?: string | null
  is_free?: boolean | null
  is_elite?: boolean | null
  is_active?: boolean | null
}

/**
 * The rung a row requires.
 *
 * `paidDefault` is the rung an unflagged row lands on, and differs per table
 * because the legacy defaults differ: betting_systems / betting_trends default
 * is_free=false (members-only unless flagged) and belong to Private, while
 * todays_bets defaults is_free=true and belongs to the Portfolio.
 */
export function rowMinTier(row: GatedRow, paidDefault: Tier): Tier {
  if (row.min_tier) return normalizeTier(row.min_tier)
  // Legacy fallback, mirroring tier_ladder_02_content_min_tier.sql exactly.
  if (row.is_elite) return 'private'
  if (row.is_free) return 'retail'
  return paidDefault
}

export interface Partitioned {
  /** Rows the member may actually see, in the order they were given. */
  visible: GatedRow[]
  /** How many rows are locked, keyed by sport, for the per-tab counts. */
  lockedCounts: Record<string, number>
  /** Record-only advertisements for locked rows, capped per sport. */
  teasers: LockedTeaser[]
  /** The cheapest rung that would unlock something currently locked. */
  unlockAt: Tier | null
}

/**
 * Split rows into what this member sees and what is advertised to them.
 *
 * Admins see everything. Inactive rows are visible to admins only and are never
 * advertised — an unpublished row must not leak its existence through a count.
 */
export function partitionBySport(
  rows: GatedRow[],
  userTier: Tier | null,
  isAdmin: boolean,
  paidDefault: Tier
): Partitioned {
  const visible: GatedRow[] = []
  const lockedCounts: Record<string, number> = {}
  const teasers: LockedTeaser[] = []
  const perSport: Record<string, number> = {}
  let unlockRank = Infinity
  let unlockAt: Tier | null = null

  for (const row of rows) {
    const required = rowMinTier(row, paidDefault)

    if (isAdmin || atLeastTier(userTier, required)) {
      visible.push(row)
      continue
    }

    // Locked. Never advertise an inactive row.
    if (row.is_active === false) continue

    lockedCounts[row.sport] = (lockedCounts[row.sport] ?? 0) + 1

    if (TIER_RANK[required] < unlockRank) {
      unlockRank = TIER_RANK[required]
      unlockAt = required
    }

    if ((perSport[row.sport] ?? 0) < TEASER_LIMIT_PER_SPORT) {
      perSport[row.sport] = (perSport[row.sport] ?? 0) + 1
      teasers.push(toTeaser(row))
    }
  }

  return { visible, lockedCounts, teasers, unlockAt }
}

/**
 * The library order: by code, uncoded rows last, then biggest sample first.
 *
 * This is what the Vault sorts on now. A code is stable — it does not move
 * when a record updates — which is the point of having one, and it groups a
 * sport together because the sport is its prefix. Mirrored by compareRows() in
 * SportTabsSystem and TrendsFilter, which re-sort the same rows on the client.
 * This ordering also decides which rows become teasers, so the two must not
 * drift.
 */
export function compareByCode(a: any, b: any): number {
  const byCode = compareCode(a?.code, b?.code)
  if (byCode !== 0) return byCode
  return compareBySample(a, b)
}

/**
 * The trends order: by code, then team A→Z (teamless rows last), then sample.
 *
 * Trends carry a team and systems do not, so the two surfaces tie-break
 * differently once a code is missing — which is every row until
 * vault_01_row_codes.sql has been applied. Mirrors compareTrends() in
 * TrendsFilter.
 */
export function compareTrendRows(a: any, b: any): number {
  const byCode = compareCode(a?.code, b?.code)
  if (byCode !== 0) return byCode
  const aTeam = (a?.team ?? '').trim().toLowerCase()
  const bTeam = (b?.team ?? '').trim().toLowerCase()
  if (aTeam !== bTeam) {
    if (!aTeam) return 1
    if (!bTeam) return -1
    return aTeam.localeCompare(bTeam)
  }
  return compareBySample(a, b)
}

/**
 * Biggest sample size first (W+L+T), then win %.
 *
 * Still the right order for a highlight reel — the Vault landing page's peek
 * leads with the deepest samples — and the tiebreak under compareByCode for
 * rows that have no code yet. The third key used to be `date`, which
 * vault_02_drop_desk_columns.sql removed.
 */
export function compareBySample(a: any, b: any): number {
  const total = (s: any) => (s.w ?? 0) + (s.l ?? 0) + (s.t ?? 0)
  const totalDiff = total(b) - total(a)
  if (totalDiff !== 0) return totalDiff
  const aPct = a.pct ?? -1
  const bPct = b.pct ?? -1
  if (aPct !== bPct) return bPct - aPct
  return compareCode(a?.code, b?.code)
}
