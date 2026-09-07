import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_MODEL_PICKS } from '@/lib/site-content'
import type { ModelPicksContent } from '@/lib/site-content'
import type { TodaysBet } from '@/components/TodaysBets'
import ModelPicksPage from '@/components/ModelPicksPage'
import ModelPicksEditor from '@/components/ModelPicksEditor'
import NeverMissAPick from '@/components/NeverMissAPick'
import { getAccess } from '@/lib/access-server'
import { atLeastTier } from '@/lib/access'
import { rowMinTier } from '@/lib/gate'
import { toBetTeaser, BET_TEASER_LIMIT } from '@/lib/teaser'
import type { LockedBetTeaser } from '@/lib/teaser'

export const metadata: Metadata = {
  // Just the page name: app/layout.tsx appends ' – EdTheStatMan.com' through
  // its title template, so carrying the site name here rendered
  // "The Portfolio — EdTheStatMan.com – EdTheStatMan.com" in the tab.
  title: 'The Portfolio',
  description: 'Every active play the model is on, updated daily, with the full line and number on each one.',
  alternates: { canonical: 'https://edthestatman.com/portfolio' },
  openGraph: {
    title: 'The Portfolio — EdTheStatMan.com',
    description: 'Every active play the model is on, updated daily, with the full line and number on each one.',
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

  // The graded record is NOT on this page. It lives on /portfolio/performance,
  // which the nav now reaches in one click, and one number in two places is one
  // number that can disagree with itself.
  //
  // `allBets` still carries the graded rows because the gate above counts them:
  // TodaysBets drops every show_on_results row when it renders
  // (components/TodaysBets.tsx:224), so they never reach the list either way.

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
      <NeverMissAPick userTier={userTier} />
    </>
  )
}
