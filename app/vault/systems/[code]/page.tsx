import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CTASection from '@/components/CTASection'
import VaultRowDetail from '@/components/VaultRowDetail'
import { createCachedClient, DB_TAGS } from '@/lib/supabase/cached'
import { getAccess } from '@/lib/access-server'
import { codeFromParam, loadVaultRow } from '@/lib/vault-row'
import { vaultRowMetadata } from '@/lib/vault-row-meta'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  return vaultRowMetadata('systems', params.code)
}

export default async function VaultSystemPage({ params }: { params: { code: string } }) {
  const code = codeFromParam(params.code)
  if (!code) notFound()

  const access = await getAccess()
  const row = await loadVaultRow(createCachedClient([DB_TAGS.vault]), 'systems', code, {
    tier: access.tier,
    isAdmin: access.isAdmin,
  })
  if (!row) notFound()

  return (
    <main>
      <VaultRowDetail kind="systems" row={row} />
      <CTASection membership={access.membership} />
    </main>
  )
}
