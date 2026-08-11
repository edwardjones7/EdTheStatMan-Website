import type { Metadata } from 'next'
import Link from 'next/link'
import CTASection from '@/components/CTASection'
import TrendsFilter from '@/components/TrendsFilter'
import PricingCards from '@/components/PricingCards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAccess, ACCESS_SELECT } from '@/lib/access'
import { toTeaser, TEASER_LIMIT_PER_SPORT } from '@/lib/teaser'
import type { LockedTeaser } from '@/lib/teaser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Betting Trends',
  description: 'Betting trends for NFL, NBA, College Football, and College Basketball. Situational edges with win percentages and unit performance.',
  alternates: { canonical: 'https://edthestatman.com/betting-trends' },
  openGraph: {
    title: 'Betting Trends – EdTheStatMan.com',
    description: 'Betting trends for NFL, NBA, College Football, and College Basketball. Situational edges with win percentages and unit performance.',
    url: 'https://edthestatman.com/betting-trends',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Betting Trends – EdTheStatMan.com',
    description: 'Betting trends for NFL, NBA, College Football, and College Basketball. Situational edges with win percentages and unit performance.',
    images: ['/og-cover.jpg'],
  },
}

export default async function BettingTrends() {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let access = resolveAccess(null, false)
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select(ACCESS_SELECT)
      .eq('id', user.id)
      .single()
    access = resolveAccess(profile as any, true)
  }
  const { tier: userTier, isAdmin, isPaid, hasElite, membership } = access

  const trendsQuery = isAdmin
    ? (admin as any).from('betting_trends').select('*').order('team', { ascending: true }).order('created_at', { ascending: false })
    : (admin as any).from('betting_trends').select('*').eq('is_active', true).order('team', { ascending: true }).order('created_at', { ascending: false })

  const { data: trends } = await trendsQuery

  const canSeeAll = isPaid || isAdmin

  // Everything is members-only except rows explicitly flagged is_free. Locked
  // rows are dropped server-side — the paywall is a count, never a CSS blur, so
  // the members-only payload never reaches a non-member's browser. Counts are
  // keyed by sport so the client can show the right number per tab.
  const allTrends = (trends ?? []) as any[]

  // Elite rows are a tier above members: basic/premium see them only as
  // redacted teasers, same as non-members see member rows.
  const nonEliteRows = allTrends.filter(t => !t.is_elite)
  const eliteRows = allTrends.filter(t => t.is_elite)

  const visibleTrends = [
    ...(hasElite ? eliteRows : []),
    ...(canSeeAll ? nonEliteRows : nonEliteRows.filter(t => t.is_free)),
  ]
  const lockedCounts: Record<string, number> = {}
  if (!canSeeAll) {
    for (const t of nonEliteRows) {
      if (t.is_free) continue
      lockedCounts[t.sport] = (lockedCounts[t.sport] ?? 0) + 1
    }
  }

  // Locked rows are advertised with their record only. toTeaser() copies fields
  // explicitly so descriptions/lines/teams/units can never ride along.
  const lockedTeasers: LockedTeaser[] = []
  if (!canSeeAll) {
    const perSport: Record<string, number> = {}
    for (const t of nonEliteRows as any[]) {
      if (t.is_free || t.is_active === false) continue
      if ((perSport[t.sport] ?? 0) >= TEASER_LIMIT_PER_SPORT) continue
      perSport[t.sport] = (perSport[t.sport] ?? 0) + 1
      lockedTeasers.push(toTeaser(t))
    }
  }

  // Elite teasers go to everyone below elite — including paid members, for whom
  // this is the upsell surface.
  const eliteLockedCounts: Record<string, number> = {}
  const eliteTeasers: LockedTeaser[] = []
  if (!hasElite) {
    const perSport: Record<string, number> = {}
    for (const t of eliteRows as any[]) {
      if (t.is_active === false) continue
      eliteLockedCounts[t.sport] = (eliteLockedCounts[t.sport] ?? 0) + 1
      if ((perSport[t.sport] ?? 0) >= TEASER_LIMIT_PER_SPORT) continue
      perSport[t.sport] = (perSport[t.sport] ?? 0) + 1
      eliteTeasers.push(toTeaser(t))
    }
  }

  return (
    <main>
      <section className="section">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Explore Trends</span>
            <h2 className="section-title">Betting Trends</h2>
            <p className="section-subtitle">Filter by sport to discover situational edges and patterns.</p>
          </div>
          <TrendsFilter trends={visibleTrends} lockedCounts={lockedCounts} lockedTeasers={lockedTeasers} eliteLockedCounts={eliteLockedCounts} eliteTeasers={eliteTeasers} userTier={userTier} isAdmin={isAdmin} />
        </div>
      </section>

      {!isPaid && (
        <section className="section" style={{ background: 'var(--bg-secondary)' }} id="pricing">
          <div className="container">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <span className="section-label">Membership</span>
              <h2 className="section-title">Choose Your <span className="text-gradient">Plan</span></h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>
                Unlock full access to betting trends, systems, and instant alerts.
              </p>
            </div>

            <div style={{ marginTop: '60px' }}>
              <PricingCards membership={membership} currentTier={userTier} />
            </div>
          </div>
        </section>
      )}

      <CTASection membership={membership} />
    </main>
  )
}
