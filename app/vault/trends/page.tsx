import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import TrendsFilter from '@/components/TrendsFilter'
import PricingCards from '@/components/PricingCards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/lib/access-server'
import { partitionBySport, compareTrendRows } from '@/lib/gate'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'The Vault — Team Trends',
  description: 'Team betting trends for NFL, NBA, College Football and College Basketball. Situational edges with full records and win percentages.',
  alternates: { canonical: 'https://edthestatman.com/vault/trends' },
  openGraph: {
    title: 'The Vault — Team Trends | EdTheStatMan.com',
    description: 'Team betting trends for NFL, NBA, College Football and College Basketball. Situational edges with full records and win percentages.',
    url: 'https://edthestatman.com/vault/trends',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Vault — Team Trends | EdTheStatMan.com',
    description: 'Team betting trends for NFL, NBA, College Football and College Basketball. Situational edges with full records and win percentages.',
    images: ['/og-cover.jpg'],
  },
}

export default async function VaultTrends() {
  const admin = createAdminClient()
  const access = await getAccess()
  const { tier: userTier, isAdmin, membership } = access

  const canSeeAll = access.atLeast('private') || isAdmin

  // Ordered by Trend ID (CFBT0001), then team for anything not coded yet. This
  // used to lead with team, which reshuffled the page every time a row was
  // renamed; the ID is stable and its prefix already groups a sport together.
  //
  // Same migration tolerance as the systems page: an ORDER BY on a column
  // vault_01_row_codes.sql has not added yet is a 42703, and a 42703 here would
  // empty the library. Order in the DB when it can, sort in JS regardless.
  const base = () => {
    const q = (admin as any).from('betting_trends').select('*')
    return isAdmin ? q : q.eq('is_active', true)
  }
  let { data: rawTrends, error } = await base()
    .order('code', { ascending: true, nullsFirst: false })
    .order('team', { ascending: true })
  if (error) ({ data: rawTrends } = await base().order('team', { ascending: true }))
  const trends = (rawTrends ?? []).sort(compareTrendRows)

  const { visible, lockedCounts, teasers } = partitionBySport(
    trends as any[], userTier, isAdmin, 'private'
  )

  return (
    <main>
      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal">
            <span className="section-label">The Vault</span>
            <h2 className="section-title">Team Trends</h2>
            <p className="section-subtitle">
              Situational edges by team, with the full record and win percentage on
              every row. Filter by sport to narrow the list.
            </p>
          </div>
          <TrendsFilter
            trends={visible as any[]}
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
                Private Intelligence unlocks the complete trends and systems libraries.
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
