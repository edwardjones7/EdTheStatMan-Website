// One Vault row (a system or a trend) as a public page, addressed by its code.
//
// /vault/systems/NFLS0006 and /vault/trends/CFBT0010. The code is the business
// key (lib/codes.ts): stable, human, unique by index, and already what a reader
// holding a row in their head would type. The uuid stays internal.
//
// THE GATE IS THE LIST'S GATE. Who may read the rule is decided exactly as
// partitionBySport() decides it for /vault/systems and /vault/trends:
// rowMinTier(row, 'private') against the viewer's tier, admins always. The
// page is public either way -- the record is the advertisement -- but for a
// locked viewer this module returns a VaultRowView with `rule` and `team` set
// to null, built field by field like toTeaser(), so the description never
// reaches the render, let alone the client.

import { atLeastTier, type Tier } from './access'
import { rowMinTier } from './gate'

export type VaultKind = 'systems' | 'trends'

export const VAULT_TABLE: Record<VaultKind, string> = {
  systems: 'betting_systems',
  trends: 'betting_trends',
}

/** What the page may render. Only `rule` and `team` are ever gated. */
export interface VaultRowView {
  code: string
  sport: string
  w: number
  l: number
  t: number
  pct: number | null
  /** The rung the row requires, for the lock's copy and its upgrade link. */
  required: Tier
  /** True when this viewer may read the rule. */
  open: boolean
  /** The description -- the IP. Null unless `open`. */
  rule: string | null
  /** Trends only. Null unless `open`: a team narrows the rule down enough to matter. */
  team: string | null
  /** Shown only with the rule, matching the list's teaser, which omits it too. */
  season: string | null
  isActive: boolean
}

/**
 * A `[code]` route param as it is stored. Codes are written upper case by every
 * editor and the importer, and only ever hold letters and digits; anything else
 * is refused before it reaches a query.
 */
export function codeFromParam(raw: string): string | null {
  let value = raw
  try { value = decodeURIComponent(raw) } catch { /* fall through with the raw value */ }
  value = value.trim().toUpperCase()
  return /^[A-Z0-9]{3,16}$/.test(value) ? value : null
}

export function vaultRowPath(kind: VaultKind, code: string): string {
  return `/vault/${kind}/${encodeURIComponent(code.toUpperCase())}`
}

/**
 * Load and redact one row for this viewer, or null for a 404.
 *
 * An inactive row is a 404 for everyone but an admin: the list never shows or
 * advertises one, and a page must not leak its existence either.
 */
export async function loadVaultRow(
  admin: any,
  kind: VaultKind,
  code: string,
  viewer: { tier: Tier | null; isAdmin: boolean }
): Promise<VaultRowView | null> {
  const { data: row, error } = await admin
    .from(VAULT_TABLE[kind])
    .select('*')
    .eq('code', code)
    .maybeSingle()
  // Before vault_01_row_codes.sql the column does not exist and this errors;
  // that is a 404 rather than a 500, same tolerance as the list pages.
  if (error || !row) return null
  if (row.is_active === false && !viewer.isAdmin) return null

  const required = rowMinTier(row, 'private')
  const open = viewer.isAdmin || atLeastTier(viewer.tier, required)
  return {
    code: row.code,
    sport: row.sport,
    w: row.w ?? 0,
    l: row.l ?? 0,
    t: row.t ?? 0,
    pct: row.pct ?? null,
    required,
    open,
    rule: open ? (row.description ?? '') : null,
    team: open && kind === 'trends' ? (row.team ?? null) : null,
    season: open ? (row.season || null) : null,
    isActive: row.is_active !== false,
  }
}
