import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_RESULTS } from '@/lib/site-content'
import type { ResultsContent } from '@/lib/site-content'
import ResultsPage from '@/components/ResultsPage'
import ResultsEditor from '@/components/ResultsEditor'
import CTASection from '@/components/CTASection'

export const metadata: Metadata = {
  title: 'Results – EdTheStatMan.com',
  description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
  openGraph: {
    title: 'Results – EdTheStatMan.com',
    description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
  },
}

export default async function Results() {
  const supabase = await createClient()

  const { data: row } = await (supabase as any)
    .from('site_content')
    .select('value')
    .eq('key', 'results')
    .single()

  const content: ResultsContent = { ...DEFAULT_RESULTS, ...((row?.value as object) ?? {}) }

  let isAdmin = false
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()
    isAdmin = !!(profile as any)?.is_admin
  }

  if (isAdmin) {
    return <ResultsEditor content={content} />
  }

  return (
    <>
      <ResultsPage content={content} />
      <CTASection />
    </>
  )
}
