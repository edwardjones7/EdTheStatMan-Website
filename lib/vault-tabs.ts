// Sport tabs for the Vault lists (systems and trends).
//
// The Research Desk covers four leagues: NFL, college football, NBA and college
// basketball. The Vault still holds rows for leagues the Desk does not cover
// (CFL, WNBA, NFL preseason). Those rows are kept, not deleted, but they sit
// behind an "Archive" tab so the default view is the four leagues a member can
// actually use this week.
//
// "all" therefore means "every Desk league" (and anything unknown, so a new
// sport added to the table is never silently hidden), and "archive" means the
// archived leagues together. A single archived league can still be picked once
// the Archive tab is open.

export type VaultTab = 'all' | 'archive' | 'nfl' | 'cfb' | 'nba' | 'cbb' | 'nflpre' | 'cfl' | 'wnba'

export const DESK_TABS: { label: string; value: VaultTab }[] = [
  { label: 'All Desk leagues', value: 'all' },
  { label: 'NFL', value: 'nfl' },
  { label: 'College Football', value: 'cfb' },
  { label: 'NBA', value: 'nba' },
  { label: 'College Basketball', value: 'cbb' },
]

export const ARCHIVE_TABS: { label: string; value: VaultTab }[] = [
  { label: 'All archived', value: 'archive' },
  { label: 'NFL Preseason', value: 'nflpre' },
  { label: 'CFL', value: 'cfl' },
  { label: 'WNBA', value: 'wnba' },
]

export const ARCHIVE_SPORTS = new Set(['nflpre', 'cfl', 'wnba'])

const ALL_TABS = [...DESK_TABS, ...ARCHIVE_TABS]

export function parseVaultTab(raw: string | null): VaultTab {
  return raw && ALL_TABS.some(t => t.value === raw) ? (raw as VaultTab) : 'all'
}

export function vaultTabLabel(tab: VaultTab): string {
  if (tab === 'archive') return 'the archive'
  return ALL_TABS.find(t => t.value === tab)?.label ?? tab
}

/** True when a tab is one real sport (so it can seed a new row's sport). */
export function isSportTab(tab: VaultTab): boolean {
  return tab !== 'all' && tab !== 'archive'
}

export function isArchiveTab(tab: VaultTab): boolean {
  return tab === 'archive' || ARCHIVE_SPORTS.has(tab)
}

export function inVaultTab(sport: string | null | undefined, tab: VaultTab): boolean {
  const s = sport ?? ''
  if (tab === 'all') return !ARCHIVE_SPORTS.has(s)
  if (tab === 'archive') return ARCHIVE_SPORTS.has(s)
  return s === tab
}

/** Sum a per-sport count map over the sports a tab shows. */
export function countForTab(counts: Record<string, number>, tab: VaultTab): number {
  let n = 0
  for (const [sport, c] of Object.entries(counts)) if (inVaultTab(sport, tab)) n += c
  return n
}
