import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_RESULTS } from '@/lib/site-content'
import type { ResultsContent } from '@/lib/site-content'
import ResultsPage from '@/components/ResultsPage'
import ResultsEditor from '@/components/ResultsEditor'
import RecentPicksResults from '@/components/RecentPicksResults'
import CTASection from '@/components/CTASection'
import type { TodaysBet } from '@/components/TodaysBets'

export const metadata: Metadata = {
  title: 'Results',
  description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
  alternates: { canonical: 'https://edthestatman.com/results' },
  openGraph: {
    title: 'Results – EdTheStatMan.com',
    description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
    url: 'https://edthestatman.com/results',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Results – EdTheStatMan.com',
    description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
    images: ['/opengraph-image'],
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
      <ResultsPage content={content} />
      <RecentPicksResults rows={recentPicks} />
      <CTASection />
    </>
  )
}
