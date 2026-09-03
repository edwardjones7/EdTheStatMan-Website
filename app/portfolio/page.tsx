import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_MODEL_PICKS } from '@/lib/site-content'
import type { ModelPicksContent } from '@/lib/site-content'
import type { TodaysBet } from '@/components/TodaysBets'
import ModelPicksPage from '@/components/ModelPicksPage'
import ModelPicksEditor from '@/components/ModelPicksEditor'
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
    (supabase as any).from('site_content').select('value').eq('key', 'model_picks').single(),
  ])

  const allBets: TodaysBet[] = betsResult.data ?? []
  const headerContent: ModelPicksContent = {
    ...DEFAULT_MODEL_PICKS,
    ...(contentResult.data?.value as object ?? {}),
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

  return isAdmin ? (
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
  )
}
