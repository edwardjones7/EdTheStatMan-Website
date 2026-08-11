import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import SportTabsSystem from '@/components/SportTabsSystem'
import PricingCards from '@/components/PricingCards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAccess, ACCESS_SELECT } from '@/lib/access'
import { toTeaser, TEASER_LIMIT_PER_SPORT } from '@/lib/teaser'
import type { LockedTeaser } from '@/lib/teaser'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Betting Systems',
  description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
  alternates: { canonical: 'https://edthestatman.com/betting-systems' },
  openGraph: {
    title: 'Betting Systems – EdTheStatMan.com',
    description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
    url: 'https://edthestatman.com/betting-systems',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Betting Systems – EdTheStatMan.com',
    description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
    images: ['/og-cover.jpg'],
  },
}

export default async function BettingSystems() {
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

  const systemsQuery = isAdmin
    ? (admin as any).from('betting_systems').select('*').order('date', { ascending: false, nullsFirst: false })
    : (admin as any).from('betting_systems').select('*').eq('is_active', true).order('date', { ascending: false, nullsFirst: false })

  const { data: rawSystems } = await systemsQuery

  // Free systems first, then most recent date (dateless last); remaining ties
  // break by highest win % first.
  const systems = (rawSystems ?? []).sort((a: any, b: any) => {
    if (!!a.is_free !== !!b.is_free) return Number(!!b.is_free) - Number(!!a.is_free)
    const aDate = a.date || ''
    const bDate = b.date || ''
    if (aDate !== bDate) {
      if (!aDate) return 1
      if (!bDate) return -1
      return bDate.localeCompare(aDate)
    }
    const aPct = a.pct ?? -1
    const bPct = b.pct ?? -1
    return bPct - aPct
  })

  const canSeeAll = isPaid || isAdmin

  // Elite rows are a tier above members: basic/premium see them only as
  // redacted teasers, same as non-members see member rows.
  const nonEliteRows = systems.filter((s: any) => !s.is_elite)
  const eliteRows = systems.filter((s: any) => s.is_elite)

  // Everything is members-only except rows explicitly flagged is_free. Locked
  // rows are dropped server-side — the paywall is a count, never a CSS blur, so
  // the members-only payload never reaches a non-member's browser. Counts are
  // keyed by sport so the client can show the right number per tab. Elite rows
  // lead the list for elite members — it's what they paid for.
  const visibleSystems = [
    ...(hasElite ? eliteRows : []),
    ...(canSeeAll ? nonEliteRows : nonEliteRows.filter((s: any) => s.is_free)),
  ]
  const lockedCounts: Record<string, number> = {}
  if (!canSeeAll) {
    for (const s of nonEliteRows) {
      if ((s as any).is_free) continue
      lockedCounts[(s as any).sport] = (lockedCounts[(s as any).sport] ?? 0) + 1
    }
  }

  // Locked rows are advertised with their record only. toTeaser() copies fields
  // explicitly so descriptions/lines/teams/units can never ride along.
  const lockedTeasers: LockedTeaser[] = []
  if (!canSeeAll) {
    const perSport: Record<string, number> = {}
    for (const s of nonEliteRows as any[]) {
      if (s.is_free || s.is_active === false) continue
      if ((perSport[s.sport] ?? 0) >= TEASER_LIMIT_PER_SPORT) continue
      perSport[s.sport] = (perSport[s.sport] ?? 0) + 1
      lockedTeasers.push(toTeaser(s))
    }
  }

  // Elite teasers go to everyone below elite — including paid members, for whom
  // this is the upsell surface.
  const eliteLockedCounts: Record<string, number> = {}
  const eliteTeasers: LockedTeaser[] = []
  if (!hasElite) {
    const perSport: Record<string, number> = {}
    for (const s of eliteRows as any[]) {
      if (s.is_active === false) continue
      eliteLockedCounts[s.sport] = (eliteLockedCounts[s.sport] ?? 0) + 1
      if ((perSport[s.sport] ?? 0) >= TEASER_LIMIT_PER_SPORT) continue
      perSport[s.sport] = (perSport[s.sport] ?? 0) + 1
      eliteTeasers.push(toTeaser(s))
    }
  }

  return (
    <main>
      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal">
            <span className="section-label">Active Systems</span>
            <h2 className="section-title">Betting Systems</h2>
            <p className="section-subtitle">Filter by sport to view system records, win percentages, and more.</p>
          </div>
          <SportTabsSystem systems={(visibleSystems ?? []) as any[]} lockedCounts={lockedCounts} lockedTeasers={lockedTeasers} eliteLockedCounts={eliteLockedCounts} eliteTeasers={eliteTeasers} userTier={userTier} isAdmin={isAdmin} />
        </div>
      </section>

      {/* Pricing — only show to non-paid users */}
      {!isPaid && (
        <section className="section" style={{ background: 'var(--bg-secondary)' }} id="pricing">
          <div className="container">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <span className="section-label">Membership</span>
              <h2 className="section-title">Choose Your <span className="text-gradient">Plan</span></h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>
                Unlock full access to betting systems, trends, and instant alerts.
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
