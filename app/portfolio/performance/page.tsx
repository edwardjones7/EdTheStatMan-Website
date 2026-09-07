import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_RESULTS } from '@/lib/site-content'
import type { ResultsContent } from '@/lib/site-content'
import ResultsPage from '@/components/ResultsPage'
import ResultsEditor from '@/components/ResultsEditor'
import RecentPicksResults from '@/components/RecentPicksResults'
import ModelPerformance from '@/components/ModelPerformance'
import type { SportRecord } from '@/components/ModelPerformance'
import CTASection from '@/components/CTASection'
import type { TodaysBet } from '@/components/TodaysBets'

export const metadata: Metadata = {
  title: 'Model Results',
  description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
  alternates: { canonical: 'https://edthestatman.com/portfolio/performance' },
  openGraph: {
    title: 'Model Results – EdTheStatMan.com',
    description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
    url: 'https://edthestatman.com/portfolio/performance',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Model Results – EdTheStatMan.com',
    description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
    images: ['/og-cover.jpg'],
  },
}

export const dynamic = 'force-dynamic'

export default async function Results() {
  const supabase = await createClient()
  const adminDb  = createAdminClient()

  const [contentResult, picksResult] = await Promise.all([
    (supabase as any).from('site_content').select('value').eq('key', 'results').single(),
    (adminDb  as any).from('todays_bets').select('*').eq('show_on_results', true).order('created_at', { ascending: false }),
  ])

  const content: ResultsContent = { ...DEFAULT_RESULTS, ...((contentResult.data?.value as object) ?? {}) }
  const recentPicks: TodaysBet[] = picksResult.data ?? []

  const wins   = recentPicks.filter(p => p.result === 'win').length
  const losses = recentPicks.filter(p => p.result === 'loss').length
  const pushes = recentPicks.filter(p => p.result === 'push').length
  const winPct = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0
  const calcStats = { wins, losses, pushes, winPct }

  // Per-sport split of the SAME graded picks the headline uses, so the two can
  // never disagree. Moved here from /portfolio when the picks page stopped
  // carrying results: this is the results page, so this is where it belongs.
  //
  // The floor bites at this grain: College Football has exactly ONE graded pick,
  // and a 1-0 sport rendering "100%" beside a 90-pick record is noise wearing
  // the costume of a result.
  const BREAKDOWN_MIN = 5
  const sportAgg = new Map<string, SportRecord>()
  for (const r of recentPicks) {
    const sport = (r.sport ?? '').trim()
    if (!sport) continue
    const agg = sportAgg.get(sport) ?? { sport, wins: 0, losses: 0, pushes: 0 }
    if (r.result === 'win') agg.wins++
    else if (r.result === 'loss') agg.losses++
    else if (r.result === 'push') agg.pushes++
    sportAgg.set(sport, agg)
  }
  const breakdown: SportRecord[] = [...sportAgg.values()]
    .filter(s => s.wins + s.losses >= BREAKDOWN_MIN)
    .sort((x, y) => {
      const px = x.wins / (x.wins + x.losses)
      const py = y.wins / (y.wins + y.losses)
      return py !== px ? py - px : (y.wins + y.losses) - (x.wins + x.losses)
    })

  let isAdmin = false
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = !!(profile as any)?.is_admin
  }

  if (isAdmin) {
    return <ResultsEditor content={content} recentPicks={recentPicks} />
  }

  return (
    <>
      <ResultsPage content={content} picks={recentPicks} />
      <RecentPicksResults rows={recentPicks} />
      <ModelPerformance
        calcStats={calcStats}
        picks={recentPicks}
        breakdown={breakdown}
        breakdownMin={BREAKDOWN_MIN}
      />
      <CTASection />
    </>
  )
}
