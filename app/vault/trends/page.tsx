import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import TrendsFilter from '@/components/TrendsFilter'
import PricingCards from '@/components/PricingCards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/lib/access-server'
import { compareTrendRows } from '@/lib/gate'
import { partitionForVisitor } from '@/lib/vault-visitor'
import SignupPrompt from '@/components/SignupPrompt'

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

  // Logged-out visitors get free rows split out, so they are told plainly
  // that those open with a free account (lib/vault-visitor.ts).
  const { visible, lockedCounts, teasers, teaserTiers, freeLockedCounts, freeTeasers } = partitionForVisitor(
    trends as any[], userTier, isAdmin, 'private'
  )
  const loggedOut = membership === 'logged-out'
  const freeTotal = Object.values(freeLockedCounts).reduce((a, b) => a + b, 0)

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
          {loggedOut && freeTotal > 0 && (
            <div style={{ marginTop: '24px' }}>
              <SignupPrompt
                context="vault_trends"
                next="/vault/trends"
                variant="banner"
                title={`${freeTotal} of these trends are free.`}
                body="They open with a free account: the full trend, not just the record. Google or one email link."
                cta="Open them free"
              />
            </div>
          )}
          <TrendsFilter
            trends={visible as any[]}
            lockedCounts={lockedCounts}
            lockedTeasers={teasers}
            eliteLockedCounts={{}}
            eliteTeasers={[]}
            userTier={userTier}
            isAdmin={isAdmin}
            teaserTiers={teaserTiers}
            freeLockedCounts={freeLockedCounts}
            freeTeasers={freeTeasers}
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
                The Handicapping Vault unlocks the complete trends and systems libraries.
                The Research Desk includes the whole Vault, plus every game and every pick.
              </p>
            </div>
            <div style={{ marginTop: '60px' }}>
              <PricingCards membership={membership} currentTier={userTier} expiresAt={access.expiresAt?.toISOString() ?? null} highlight="private" />
            </div>
          </div>
        </section>
      )}

      <CTASection membership={membership} />
    </main>
  )
}
