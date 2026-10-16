// The Vault, split for whoever is looking -- with free rows told apart for
// logged-out visitors.
//
// WHY. partitionBySport() locks every row the viewer's tier does not reach, and
// a logged-out visitor has no tier, so the FREE rows were locked for them too
// and folded in with the paid ones: the stats bar read "Free Systems 0" and
// every lock linked to /win, telling someone a price stood between them and
// rows that cost nothing. Free rows open with a free account, so they are now
// counted and advertised separately and their locks go to signup.
//
// The house rule is unchanged: a locked free row still reaches the client only
// as a record-only teaser (lib/teaser.ts). An account, not a payment, is what
// opens it, but it is still not shown to someone without one.

import { partitionBySport, rowMinTier, type GatedRow, type Partitioned } from './gate'
import { toTeaser, TEASER_LIMIT_PER_SPORT, type LockedTeaser } from './teaser'
import type { Tier } from './access'

export interface VisitorPartition extends Partitioned {
  /** The rung each locked teaser needs, by teaser id, for the /win deep link. */
  teaserTiers: Record<string, Tier>
  /** Logged-out only: free rows per sport, locked until they sign up. */
  freeLockedCounts: Record<string, number>
  /** Logged-out only: record-only teasers for those free rows. */
  freeTeasers: LockedTeaser[]
}

export function partitionForVisitor(
  rows: GatedRow[],
  userTier: Tier | null,
  isAdmin: boolean,
  paidDefault: Tier
): VisitorPartition {
  const loggedOut = userTier === null && !isAdmin
  const free: GatedRow[] = []
  const rest: GatedRow[] = []
  for (const row of rows) {
    if (loggedOut && rowMinTier(row, paidDefault) === 'retail') free.push(row)
    else rest.push(row)
  }

  const base = partitionBySport(rest, userTier, isAdmin, paidDefault)

  const teaserTiers: Record<string, Tier> = {}
  const byId = new Map(rest.map(r => [r.id, r]))
  for (const t of base.teasers) {
    const row = byId.get(t.id)
    if (row) teaserTiers[t.id] = rowMinTier(row, paidDefault)
  }

  const freeLockedCounts: Record<string, number> = {}
  const freeTeasers: LockedTeaser[] = []
  const perSport: Record<string, number> = {}
  for (const row of free) {
    // Same rule partitionBySport applies: an inactive row is never advertised.
    if (row.is_active === false) continue
    freeLockedCounts[row.sport] = (freeLockedCounts[row.sport] ?? 0) + 1
    if ((perSport[row.sport] ?? 0) < TEASER_LIMIT_PER_SPORT) {
      perSport[row.sport] = (perSport[row.sport] ?? 0) + 1
      freeTeasers.push(toTeaser(row))
    }
  }

  return { ...base, teaserTiers, freeLockedCounts, freeTeasers }
}
