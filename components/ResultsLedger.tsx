import Link from 'next/link'
import '@/styles/proof-win.css'
import { bookOf, oddsOf, unitsFor, DEFAULT_ODDS } from '@/lib/records'
import { BOOK_LABEL } from '@/lib/proof'

/**
 * The graded log on /portfolio/performance, one page at a time.
 *
 * Server component. It replaced RecentPicksResults on the public page, which
 * was a client component handed every graded row (select('*'), notes and
 * internal columns included) and rendered all of them -- with the same array
 * serialised twice more for ResultsPage and ModelPerformance, the page weighed
 * ~600KB. Now only the 50 rows on screen are rendered and nothing is shipped to
 * the browser to hydrate.
 *
 * At phone width each row stacks into a card (CSS, styles/proof-win.css), with
 * labels from data-label, so the table never scrolls sideways.
 */

export interface LedgerRow {
  id: string
  date: string | null
  sport: string | null
  bet: string | null
  line: string | null
  vig: string | null
  opponent: string | null
  result: string | null
  is_free?: boolean | null
  odds?: number | null
}

export const LEDGER_PAGE_SIZE = 50

const RESULT_LABEL: Record<string, string> = { win: 'Win', loss: 'Loss', push: 'Push' }

function unitsCell(row: LedgerRow): { text: string; assumed: boolean } | null {
  const r = String(row.result ?? '').toLowerCase()
  if (!RESULT_LABEL[r]) return null
  const price = oddsOf(row)
  const u = unitsFor(r, price ?? DEFAULT_ODDS)
  return { text: `${u > 0 ? '+' : ''}${u.toFixed(2)}`, assumed: price === null }
}

interface Props {
  /** The page's rows only, newest first. */
  rows: LedgerRow[]
  page: number
  pageCount: number
  total: number
}

/** "Wed, Nov 11" from a stored YYYY-MM-DD; anything else as it is. */
function ledgerDate(d: string | null): string {
  if (!d) return '—'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export default function ResultsLedger({ rows, page, pageCount, total }: Props) {
  const first = (page - 1) * LEDGER_PAGE_SIZE + 1
  const last = first + rows.length - 1
  const href = (p: number) => (p <= 1 ? '/portfolio/performance#ledger' : `/portfolio/performance?page=${p}#ledger`)

  return (
    <section className="section ledger" id="ledger" aria-labelledby="ledger-heading">
      <div className="container">
        <div className="ledger__head">
          <h2 id="ledger-heading" className="ledger__title">Every graded pick</h2>
          <p className="ledger__sub">
            {total > 0
              ? <>Showing {first}&ndash;{last} of {total}, newest first. Units are one unit risked per pick; <span aria-hidden="true">†</span> marks a pick with no recorded price, scored at -110.</>
              : 'No graded picks yet.'}
          </p>
        </div>

        {rows.length > 0 && (
          <table className="ledger__table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Sport</th>
                <th scope="col">Pick</th>
                <th scope="col">Line</th>
                <th scope="col">Closing</th>
                <th scope="col">Opponent</th>
                <th scope="col">Book</th>
                <th scope="col">Result</th>
                <th scope="col" className="ledger__num">Units</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const r = String(row.result ?? '').toLowerCase()
                const u = unitsCell(row)
                return (
                  <tr key={row.id}>
                    <td data-label="Date" className="ledger__date">{ledgerDate(row.date)}</td>
                    <td data-label="Sport" className="ledger__sport"><span className="ledger__tag">{row.sport ?? '—'}</span></td>
                    <td data-label="Pick" className="ledger__pick">{row.bet ?? '—'}</td>
                    <td data-label="Line" className="ledger__mono">{row.line ?? '—'}</td>
                    <td data-label="Closing" className="ledger__mono">{row.vig ?? '—'}</td>
                    <td data-label="Opponent">{row.opponent ?? '—'}</td>
                    <td data-label="Book">{BOOK_LABEL[bookOf(row)]}</td>
                    <td data-label="Result">
                      <span className={`ledger__result ledger__result--${r || 'pending'}`}>
                        {RESULT_LABEL[r] ?? 'Pending'}
                      </span>
                    </td>
                    <td data-label="Units" className="ledger__num ledger__mono">
                      {u ? <>{u.text}{u.assumed && <span title="No recorded price; scored at -110">†</span>}</> : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {pageCount > 1 && (
          <nav className="ledger__pager" aria-label="Ledger pages">
            {page > 1
              ? <Link href={href(page - 1)} className="btn btn--outline btn--sm">&larr; Newer</Link>
              : <span />}
            <span className="ledger__pageno">Page {page} of {pageCount}</span>
            {page < pageCount
              ? <Link href={href(page + 1)} className="btn btn--outline btn--sm">Older &rarr;</Link>
              : <span />}
          </nav>
        )}
      </div>
    </section>
  )
}
