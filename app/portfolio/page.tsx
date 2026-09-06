import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_MODEL_PICKS, DEFAULT_SYSTEMS_OVERVIEW } from '@/lib/site-content'
import type { ModelPicksContent, SystemsOverviewContent } from '@/lib/site-content'
import type { TodaysBet } from '@/components/TodaysBets'
import ModelPicksPage from '@/components/ModelPicksPage'
import ModelPicksEditor from '@/components/ModelPicksEditor'
import RecentPicksResults from '@/components/RecentPicksResults'
import ModelPerformance from '@/components/ModelPerformance'
import SystemsOverview from '@/components/SystemsOverview'
import { SPORT_LABEL, isSport } from '@/lib/desk'
import type { Sport } from '@/lib/desk'
import { getAccess } from '@/lib/access-server'
import { atLeastTier } from '@/lib/access'
import { rowMinTier } from '@/lib/gate'
import { toBetTeaser, BET_TEASER_LIMIT } from '@/lib/teaser'
import type { LockedBetTeaser } from '@/lib/teaser'

export const metadata: Metadata = {
  title: 'The Portfolio — EdTheStatMan.com',
  description: 'Every pick, graded. Active plays updated daily with full transparency and a complete record.',
  alternates: { canonical: 'https://edthestatman.com/portfolio' },
  openGraph: {
    title: 'The Portfolio — EdTheStatMan.com',
    description: 'Every pick, graded. Active plays updated daily with full transparency and a complete record.',
    url: 'https://edthestatman.com/portfolio',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
}

export const dynamic = 'force-dynamic'

export default async function Portfolio() {
  const supabase = await createClient()
  const adminDb = createAdminClient()

  const [betsResult, contentResult, systemsResult] = await Promise.all([
    (adminDb as any).from('todays_bets').select('*').order('created_at', { ascending: false }),
    (supabase as any).from('site_content').select('key, value').in('key', ['model_picks', 'systems_overview']),
    (adminDb as any).from('betting_systems').select('sport, w, l, t').eq('is_active', true),
  ])

  const allBets: TodaysBet[] = betsResult.data ?? []

  // .in() rather than two .single() calls -- and no .single(), which errors when
  // a key has never been saved rather than falling back to the default.
  const contentByKey: Record<string, unknown> = {}
  for (const row of (contentResult.data ?? []) as { key: string; value: unknown }[]) {
    contentByKey[row.key] = row.value
  }

  const headerContent: ModelPicksContent = {
    ...DEFAULT_MODEL_PICKS,
    ...(contentByKey.model_picks as object ?? {}),
  }

  // Per-sport records, COMPUTED from the active systems rather than typed.
  //
  // The saved site_content copy was four hand-maintained cards, every one of
  // them 0-0, still naming NBA Playoffs and the NCAA Tournament from last
  // basketball season. Rendering that on the page a buyer decides on is worse
  // than rendering nothing. Hand-kept numbers next to live ones is the whole
  // failure mode; these move on their own.
  //
  // Copy stays editable (title, subtitle, footer); only the cards are derived.
  const sportAgg = new Map<Sport, { w: number; l: number; t: number }>()
  for (const r of (systemsResult.data ?? []) as { sport: string; w: number; l: number; t: number }[]) {
    const key = (r.sport ?? '').toLowerCase()
    if (!isSport(key)) continue
    const a = sportAgg.get(key) ?? { w: 0, l: 0, t: 0 }
    a.w += r.w ?? 0; a.l += r.l ?? 0; a.t += r.t ?? 0
    sportAgg.set(key, a)
  }

  const savedOverview = (contentByKey.systems_overview as Partial<SystemsOverviewContent>) ?? {}
  const systemsOverview: SystemsOverviewContent = {
    ...DEFAULT_SYSTEMS_OVERVIEW,
    ...savedOverview,
    // Every card here is an ACTIVE system by construction, so none is 'ended' --
    // which matters, because SystemsOverview filters ended cards out entirely.
    cards: [...sportAgg.entries()]
      .sort((a, b) => (b[1].w + b[1].l) - (a[1].w + a[1].l))
      .map(([sport, a]) => ({
        sport,
        name: SPORT_LABEL[sport],
        statusLabel: 'Active',
        statusType: 'active' as const,
        wins: a.w,
        losses: a.l,
      })),
  }

  const access = await getAccess()
  const { tier: userTier, isAdmin } = access

  // The picks ARE the Portfolio product, so they open at that rung. Rows are
  // classified through rowMinTier() so this works before and after the
  // min_tier migration -- see lib/gate.ts.
  const isMember = isAdmin || access.atLeast('portfolio')

  const required = (b: TodaysBet) => rowMinTier(b as any, 'portfolio')
  const canSee = (b: TodaysBet) => isAdmin || atLeastTier(userTier, required(b))

  // One list, one gate. Locked picks are dropped server-side and advertised
  // only as a count plus a redacted stand-in row.
  const todaysBets = allBets.filter(canSee)
  const lockedRows = allBets.filter(b => !canSee(b) && !b.show_on_results)

  // Split the advertisement by rung so the upsell points somewhere specific:
  // ordinary locked picks sell the Portfolio, the former Edge Picks sell the
  // Vault. toBetTeaser() copies fields explicitly, so the pick itself, its
  // line, vig, opponent and note never leave the server.
  // A row is "Portfolio-locked" when buying the Portfolio would unlock it, i.e.
  // the portfolio rung already satisfies its requirement.
  const portfolioLocked = lockedRows.filter(b => atLeastTier('portfolio', required(b)))
  const vaultLocked = lockedRows.filter(b => !atLeastTier('portfolio', required(b)))

  const lockedCount = portfolioLocked.length
  const lockedBets: LockedBetTeaser[] = portfolioLocked
    .slice(0, BET_TEASER_LIMIT)
    .map(toBetTeaser)

  const eliteLockedBets: LockedBetTeaser[] = vaultLocked
    .slice(0, BET_TEASER_LIMIT)
    .map(toBetTeaser)

  // ---- The graded record, under the open plays -------------------------------
  // TodaysBets drops every show_on_results row (components/TodaysBets.tsx:209),
  // so this page rendered only the handful of open picks and the 199 graded ones
  // appeared nowhere on it. "Complete graded history" is a Portfolio bullet, so
  // the record belongs on the product's own page, not only on /portfolio/performance.
  //
  // Same source, filter and arithmetic as that page, deliberately: two pages
  // quoting different records is worse than either number alone. allBets is
  // already ordered created_at desc, which is the order both components expect.
  //
  // NOT gated. The record is public on /portfolio/performance and in the homepage
  // brief; hiding it here would make the paywall look like it covers the results
  // rather than the picks.
  const recentPicks: TodaysBet[] = allBets.filter(b => b.show_on_results)
  const wins   = recentPicks.filter(p => p.result === 'win').length
  const losses = recentPicks.filter(p => p.result === 'loss').length
  const pushes = recentPicks.filter(p => p.result === 'push').length
  const winPct = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0
  const calcStats = { wins, losses, pushes, winPct }

  return (
    <>
      {isAdmin ? (
        <ModelPicksEditor rows={todaysBets} userTier={userTier} headerContent={headerContent} />
      ) : (
        <ModelPicksPage
          rows={todaysBets}
          isAdmin={false}
          userTier={userTier}
          isMember={isMember}
          lockedCount={lockedCount}
          lockedBets={lockedBets}
          eliteLockedBets={eliteLockedBets}
          headerContent={headerContent}
        />
      )}
      <ModelPerformance calcStats={calcStats} picks={recentPicks} />
      <SystemsOverview content={systemsOverview} />
      <RecentPicksResults rows={recentPicks} />
    </>
  )
}
