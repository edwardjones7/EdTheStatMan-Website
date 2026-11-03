import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_RESULTS } from '@/lib/site-content'
import type { ResultsContent } from '@/lib/site-content'
import ResultsEditor from '@/components/ResultsEditor'
import CTASection from '@/components/CTASection'
import ProofStrip from '@/components/ProofStrip'
import BookCards from '@/components/BookCards'
import ResultsLedger, { LEDGER_PAGE_SIZE, type LedgerRow } from '@/components/ResultsLedger'
import type { TodaysBet } from '@/components/TodaysBets'
import { getAccess } from '@/lib/access-server'
import { buildProof, loadPublishedPicks } from '@/lib/proof'
import '@/styles/proof-win.css'

export const metadata: Metadata = {
  title: 'Model Results',
  description: 'Every graded pick, win or lose: the members’ card and the free picks as two records, with splits by sport.',
  alternates: { canonical: 'https://edthestatman.com/portfolio/performance' },
  openGraph: {
    title: 'Model Results – EdTheStatMan.com',
    description: 'Every graded pick, win or lose, with records by sport.',
    url: 'https://edthestatman.com/portfolio/performance',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Model Results – EdTheStatMan.com',
    description: 'Every graded pick, win or lose, with records by sport.',
    images: ['/og-cover.jpg'],
  },
}

export const dynamic = 'force-dynamic'

/**
 * Newest first. `date` is free text on older rows ("Mar 19") and ISO on newer
 * ones, so it is only trusted when it parses to a full date; otherwise the
 * row's created_at decides.
 */
function sortKey(r: Pick<TodaysBet, 'date' | 'created_at'>): number {
  if (r.date && /^\d{4}-\d{2}-\d{2}/.test(r.date)) {
    const t = Date.parse(r.date)
    if (!Number.isNaN(t)) return t
  }
  const c = Date.parse(r.created_at)
  return Number.isNaN(c) ? 0 : c
}

export default async function Results({ searchParams }: { searchParams: { page?: string } }) {
  const access = await getAccess()

  // Paged past PostgREST's silent 1,000-row cap (lib/supabase/select-all.ts).
  // Every graded pick counts toward the record, so a short read would quietly
  // change the numbers.
  const picks = (await loadPublishedPicks<TodaysBet & { odds?: number | null }>())
    .sort((a, b) => sortKey(b) - sortKey(a))

  if (access.isAdmin) {
    // The editor still edits the site_content block and the rows in place;
    // it keeps the old full-list layout on purpose.
    const supabase = await createClient()
    const { data } = await (supabase as any).from('site_content').select('value').eq('key', 'results').single()
    const content: ResultsContent = { ...DEFAULT_RESULTS, ...((data?.value as object) ?? {}) }
    return <ResultsEditor content={content} recentPicks={picks} />
  }

  const proof = buildProof(picks)

  // Only graded rows are the ledger: a pending row flagged for results has no
  // result to show yet and the record does not count it either.
  const graded = picks.filter(p => ['win', 'loss', 'push'].includes(String(p.result ?? '').toLowerCase()))
  const pageCount = Math.max(1, Math.ceil(graded.length / LEDGER_PAGE_SIZE))
  const requested = Number.parseInt(searchParams.page ?? '1', 10)
  const page = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), pageCount) : 1

  // Field by field: only what the ledger renders crosses into the HTML.
  const pageRows: LedgerRow[] = graded
    .slice((page - 1) * LEDGER_PAGE_SIZE, page * LEDGER_PAGE_SIZE)
    .map(p => ({
      id: p.id, date: p.date, sport: p.sport, bet: p.bet, line: p.line, vig: p.vig,
      opponent: p.opponent, result: p.result, is_free: p.is_free, odds: p.odds ?? null,
    }))

  return (
    <main>
      <header className="page-header perf-header">
        <div className="container">
          <span className="section-label">Live Track Record</span>
          <h1 className="page-header__title">Model <span className="text-gradient">Results</span></h1>
          <p className="page-header__subtitle">
            Every graded pick, win or lose. The members&apos; card and the free picks are kept as
            two separate records, split by sport, with the full log underneath.
          </p>
        </div>
      </header>

      <section className="perf-proof" aria-label="Headline record">
        <div className="container">
          <ProofStrip proof={proof} showLedgerLink={false} />
        </div>
      </section>

      <BookCards proof={proof} rows={picks} />

      <ResultsLedger rows={pageRows} page={page} pageCount={pageCount} total={graded.length} />

      <CTASection membership={access.membership} />
    </main>
  )
}
