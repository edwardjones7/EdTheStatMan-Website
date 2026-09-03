import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import TrendsFilter from '@/components/TrendsFilter'
import PricingCards from '@/components/PricingCards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/lib/access-server'
import { partitionBySport } from '@/lib/gate'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'The Vault — Team Trends',
  description: 'Team betting trends for NFL, NBA, College Football and College Basketball. Situational edges with win percentages and unit performance.',
  alternates: { canonical: 'https://edthestatman.com/vault/trends' },
  openGraph: {
    title: 'The Vault — Team Trends | EdTheStatMan.com',
    description: 'Team betting trends for NFL, NBA, College Football and College Basketball. Situational edges with win percentages and unit performance.',
    url: 'https://edthestatman.com/vault/trends',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Vault — Team Trends | EdTheStatMan.com',
    description: 'Team betting trends for NFL, NBA, College Football and College Basketball. Situational edges with win percentages and unit performance.',
    images: ['/og-cover.jpg'],
  },
}

export default async function VaultTrends() {
  const admin = createAdminClient()
  const access = await getAccess()
  const { tier: userTier, isAdmin, membership } = access

  const canSeeAll = access.atLeast('private') || isAdmin

  // Team-centric ordering: this is the "team trends" surface, so rows group by
  // team rather than by recency the way systems do.
  const trendsQuery = isAdmin
    ? (admin as any).from('betting_trends').select('*')
        .order('team', { ascending: true }).order('created_at', { ascending: false })
    : (admin as any).from('betting_trends').select('*').eq('is_active', true)
        .order('team', { ascending: true }).order('created_at', { ascending: false })

  const { data: trends } = await trendsQuery

  const { visible, lockedCounts, teasers } = partitionBySport(
    (trends ?? []) as any[], userTier, isAdmin, 'private'
  )

  return (
    <main>
      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal">
            <span className="section-label">The Vault</span>
            <h2 className="section-title">Team Trends</h2>
            <p className="section-subtitle">
              Situational edges by team, with win percentages and unit performance.
              Filter by sport or team to narrow the list.
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
