import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_MODEL_PICKS } from '@/lib/site-content'
import type { ModelPicksContent } from '@/lib/site-content'
import type { TodaysBet } from '@/components/TodaysBets'
import ModelPicksPage from '@/components/ModelPicksPage'
import ModelPicksEditor from '@/components/ModelPicksEditor'
import RecentPicksResults from '@/components/RecentPicksResults'
import ModelPerformance from '@/components/ModelPerformance'
import type { TeamRecord } from '@/components/ModelPerformance'
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

  const [betsResult, contentResult] = await Promise.all([
    (adminDb as any).from('todays_bets').select('*').order('created_at', { ascending: false }),
    (supabase as any).from('site_content').select('key, value').eq('key', 'model_picks'),
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

  // Per-team split of the SAME graded picks, so the headline and the breakdown
  // can never disagree. `bet` holds the team taken; `opponent` is the other side.
  //
  // The floor is not decoration. Of the 50 teams picked, 15 have exactly ONE
  // graded pick, and a 1-0 team rendering "100%" is noise wearing the costume of
  // a result -- on the page where somebody decides to pay.
  const BREAKDOWN_MIN = 5
  const teamAgg = new Map<string, TeamRecord>()
  for (const r of recentPicks) {
    const team = (r.bet ?? '').trim()
    if (!team) continue
    // Keyed with the sport: the same nickname can exist in two leagues.
    const key = team + '|' + (r.sport ?? '')
    const agg = teamAgg.get(key) ?? { team, sport: r.sport ?? '', wins: 0, losses: 0, pushes: 0 }
    if (r.result === 'win') agg.wins++
    else if (r.result === 'loss') agg.losses++
    else if (r.result === 'push') agg.pushes++
    teamAgg.set(key, agg)
  }
  const breakdown: TeamRecord[] = [...teamAgg.values()]
    .filter(t => t.wins + t.losses >= BREAKDOWN_MIN)
    .sort((x, y) => {
      const px = x.wins / (x.wins + x.losses)
      const py = y.wins / (y.wins + y.losses)
      return py !== px ? py - px : (y.wins + y.losses) - (x.wins + x.losses)
    })

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
      <ModelPerformance
        calcStats={calcStats}
        picks={recentPicks}
        breakdown={breakdown}
        breakdownMin={BREAKDOWN_MIN}
      />
      <RecentPicksResults rows={recentPicks} />
    </>
  )
}
