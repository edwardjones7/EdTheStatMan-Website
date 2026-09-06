import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import SportTabsSystem from '@/components/SportTabsSystem'
import PricingCards from '@/components/PricingCards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/lib/access-server'
import { partitionBySport, compareByCode } from '@/lib/gate'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'The Vault — Betting Systems',
  description: 'The full systems library: NFL, College Football, NBA and College Basketball, with complete records and win percentages.',
  alternates: { canonical: 'https://edthestatman.com/vault/systems' },
  openGraph: {
    title: 'The Vault — Betting Systems | EdTheStatMan.com',
    description: 'The full systems library: NFL, College Football, NBA and College Basketball, with complete records and win percentages.',
    url: 'https://edthestatman.com/vault/systems',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Vault — Betting Systems | EdTheStatMan.com',
    description: 'The full systems library: NFL, College Football, NBA and College Basketball, with complete records and win percentages.',
    images: ['/og-cover.jpg'],
  },
}

export default async function VaultSystems() {
  const admin = createAdminClient()
  const access = await getAccess()
  const { tier: userTier, isAdmin, membership } = access

  // The library itself is the Private product. Desk members reach curated rows
  // through a matchup on the Research Desk, never as a browsable list.
  const canSeeAll = access.atLeast('private') || isAdmin

  // Ordered by System ID (CFBS0001), uncoded rows last.
  //
  // The DB does the sort so the index earns its keep, and compareByCode applies
  // it again here: it is the single comparator, it decides which rows become
  // teasers, and the client re-sorts with the same rules.
  //
  // MIGRATION TOLERANT, like everything else that reads these tables. This
  // deploys before vault_01_row_codes.sql is necessarily applied, and PostgREST
  // answers an ORDER BY on an unknown column with 42703 -- which would render
  // the whole library empty. So the ordered query is tried, and a failure falls
  // back to the unordered one rather than to a blank page.
  const base = () => {
    const q = (admin as any).from('betting_systems').select('*')
    return isAdmin ? q : q.eq('is_active', true)
  }
  let { data: rawSystems, error } = await base().order('code', { ascending: true, nullsFirst: false })
  if (error) ({ data: rawSystems } = await base())
  const systems = (rawSystems ?? []).sort(compareByCode)

  const { visible, lockedCounts, teasers } = partitionBySport(
    systems as any[], userTier, isAdmin, 'private'
  )

  return (
    <main>
      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal">
            <span className="section-label">The Vault</span>
            <h2 className="section-title">Betting Systems</h2>
            <p className="section-subtitle">
              Every system we track, with its full record. Filter by sport to see
              win percentages, sample sizes and season data.
            </p>
          </div>
          <SportTabsSystem
            systems={visible as any[]}
            lockedCounts={lockedCounts}
            lockedTeasers={teasers}
            eliteLockedCounts={{}}
            eliteTeasers={[]}
            userTier={userTier}
            isAdmin={isAdmin}
          />
        </div>
      </section>

      {!canSeeAll && (
        <section className="section" style={{ background: 'var(--bg-secondary)' }} id="pricing">
          <div className="container">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <span className="section-label">Membership</span>
              <h2 className="section-title">Open the <span className="text-gradient">Vault</span></h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>
                Private Intelligence unlocks the complete systems and trends libraries.
                Institutional adds the raw rows underneath them.
              </p>
            </div>
            <div style={{ marginTop: '60px' }}>
              <PricingCards membership={membership} currentTier={userTier} highlight="private" />
            </div>
          </div>
        </section>
      )}

      <CTASection membership={membership} />
    </main>
  )
}
