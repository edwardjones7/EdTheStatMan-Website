// The Vault's business keys: CFBS0001, NFLT0012, WNBAT0003.
//
// Every system and every trend carries a `code` — a short, typed, unique
// handle. `id` stays the uuid the joins use; `code` is the one a person says
// out loud, sorts by, and looks up. Pure module: the admin editors, the public
// library pages and the ordering in lib/gate.ts all read it.
//
// SHAPE: <sport prefix><S|T><4 digits>. Zero padded because the sort is a text
// sort — CFBS0009 must come before CFBS0010, and "CFBS9" would not.
//
// The prefix table is mirrored in supabase/migrations/vault_01_row_codes.sql,
// which backfilled the existing rows. Adding a sport means adding it in both
// places, or the app will suggest codes the backfill would never have made.

export const SPORT_CODE: Record<string, string> = {
  nfl: 'NFL',
  nflpre: 'NFLP',
  cfl: 'CFL',
  cfb: 'CFB',
  nba: 'NBA',
  wnba: 'WNBA',
  cbb: 'CBB',
}

/** S for a system, T for a trend — the two tables that carry codes. */
export type CodeKind = 'S' | 'T'

export function codePrefix(sport: string, kind: CodeKind): string {
  return `${SPORT_CODE[sport] ?? sport.toUpperCase()}${kind}`
}

export function buildCode(sport: string, kind: CodeKind, n: number): string {
  return `${codePrefix(sport, kind)}${String(n).padStart(4, '0')}`
}

/**
 * The next free code for a sport, from the codes already in hand.
 *
 * Highest existing number plus one, never a count: deleting row 7 of 9 must
 * not hand the next row a code that is already taken. This only ever sees the
 * rows loaded into the page, so treat it as a suggestion the admin can
 * overwrite — the unique index on the table is what actually guarantees it.
 */
export function nextCode(sport: string, kind: CodeKind, existing: (string | null | undefined)[]): string {
  const prefix = codePrefix(sport, kind)
  let max = 0
  for (const raw of existing) {
    const code = (raw ?? '').trim().toUpperCase()
    if (!code.startsWith(prefix)) continue
    const n = parseInt(code.slice(prefix.length), 10)
    if (!isNaN(n) && n > max) max = n
  }
  return buildCode(sport, kind, max + 1)
}

/**
 * Order by code, uncoded rows last.
 *
 * `numeric` so a hand-typed CFBS7 still lands between CFBS6 and CFBS10 rather
 * than after CFBS69, and `sensitivity: 'base'` so case never decides an order
 * the unique index already treats as the same key.
 */
export function compareCode(a: string | null | undefined, b: string | null | undefined): number {
  const aCode = (a ?? '').trim()
  const bCode = (b ?? '').trim()
  if (!aCode && !bCode) return 0
  if (!aCode) return 1
  if (!bCode) return -1
  return aCode.localeCompare(bCode, 'en', { numeric: true, sensitivity: 'base' })
}
