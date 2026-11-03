import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import SportTabsSystem from '@/components/SportTabsSystem'
import PricingCards from '@/components/PricingCards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/lib/access-server'
import { compareByCode } from '@/lib/gate'
import { partitionForVisitor } from '@/lib/vault-visitor'
import SignupPrompt from '@/components/SignupPrompt'

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

  // Logged-out visitors get free rows split out, so they are told plainly
  // that those open with a free account (lib/vault-visitor.ts).
  const { visible, lockedCounts, teasers, teaserTiers, freeLockedCounts, freeTeasers } = partitionForVisitor(
    systems as any[], userTier, isAdmin, 'private'
  )
  const loggedOut = membership === 'logged-out'
  const freeTotal = Object.values(freeLockedCounts).reduce((a, b) => a + b, 0)

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
          {loggedOut && freeTotal > 0 && (
            <div style={{ marginTop: '24px' }}>
              <SignupPrompt
                context="vault_systems"
                next="/vault/systems"
                variant="banner"
                title={`${freeTotal} of these systems are free.`}
                body="They open with a free account: the full rule, not just the record. Google or one email link."
                cta="Open them free"
              />
            </div>
          )}
          <SportTabsSystem
            systems={visible as any[]}
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
                The Handicapping Vault unlocks the complete systems and trends libraries.
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
