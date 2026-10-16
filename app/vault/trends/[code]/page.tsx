import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CTASection from '@/components/CTASection'
import VaultRowDetail from '@/components/VaultRowDetail'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/lib/access-server'
import { codeFromParam, loadVaultRow } from '@/lib/vault-row'
import { vaultRowMetadata } from '@/lib/vault-row-meta'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  return vaultRowMetadata('trends', params.code)
}

// Same page as a system's: betting_trends has the same shape plus `team`, and
// the same gate. See lib/vault-row.ts.
export default async function VaultTrendPage({ params }: { params: { code: string } }) {
  const code = codeFromParam(params.code)
  if (!code) notFound()

  const access = await getAccess()
  const row = await loadVaultRow(createAdminClient(), 'trends', code, {
    tier: access.tier,
    isAdmin: access.isAdmin,
  })
  if (!row) notFound()

  return (
    <main>
      <VaultRowDetail kind="trends" row={row} />
      <CTASection membership={access.membership} />
    </main>
  )
}
