// Metadata for a Vault row page, shared by systems and trends.
//
// Built from an ANONYMOUS view of the row, whoever is asking: the title and
// description land in the HTML head, which is what a crawler indexes and what a
// share card shows, so they must never carry the rule even when the person
// rendering the page is entitled to it.

import type { Metadata } from 'next'
import { createCachedClient, DB_TAGS } from './supabase/cached'
import { SPORT_LABEL, type Sport } from './desk'
import { codeFromParam, loadVaultRow, vaultRowPath, type VaultKind } from './vault-row'

export async function vaultRowMetadata(kind: VaultKind, rawCode: string): Promise<Metadata> {
  const code = codeFromParam(rawCode)
  const row = code
    ? await loadVaultRow(createCachedClient([DB_TAGS.vault]), kind, code, { tier: null, isAdmin: false })
    : null
  if (!row) return { title: 'Not Found' }

  const sport = SPORT_LABEL[row.sport as Sport] ?? row.sport.toUpperCase()
  const noun = kind === 'systems' ? 'Betting System' : 'Betting Trend'
  const sample = row.w + row.l + row.t
  const pct = row.pct === null ? null : Math.round(row.pct * 100)
  const record = `${row.w}-${row.l}-${row.t}`
  const title = `${row.code}: ${sport} ${noun}, ${record}${pct === null ? '' : ` (${pct}%)`}`
  const description = `${sport} ${noun.toLowerCase()} ${row.code} is ${record}${pct === null ? '' : `, winning ${pct}%`} over ${sample} game${sample === 1 ? '' : 's'}. The full record is public; the ${kind === 'systems' ? 'system' : 'trend'} itself is in the EdTheStatMan Vault.`
  const url = `https://edthestatman.com${vaultRowPath(kind, row.code)}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | EdTheStatMan.com`, description, url, images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: `${title} | EdTheStatMan.com`, description, images: ['/og-cover.jpg'] },
  }
}
