import Link from 'next/link'
import {
  bookOf, computeRecord, recordsBySport, formatRecord, formatUnits,
  BREAK_EVEN_PCT, MIN_DECISIONS, type Book, type PickRecord, type RecordSource,
} from '@/lib/records'

const BOOK_TITLE: Record<Book, string> = { free: 'Free picks', members: "Members' card" }
const BOOK_BLURB: Record<Book, string> = {
  free: 'The picks Ed gives away, props included.',
  members: 'The paid card, graded the same way.',
}

function since(r: PickRecord): string | null {
  if (!r.from) return null
  const d = new Date(`${r.from}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'America/New_York' })
}

function BookPanel({ book, rows }: { book: Book; rows: RecordSource[] }) {
  const mine = rows.filter(r => bookOf(r) === book)
  const r = computeRecord(mine)
  const sports = recordsBySport(mine)
  const graded = r.w + r.l + r.p
  const from = since(r)

  return (
    <div className={`pick-book pick-book--${book}`}>
      <div className="pick-book__head">
        <h3 className="pick-book__title">{BOOK_TITLE[book]}</h3>
        <p className="pick-book__blurb">{BOOK_BLURB[book]}</p>
      </div>
      {graded === 0 ? (
        <p className="pick-book__empty">No graded picks yet.</p>
      ) : (
        <>
          <div className="pick-book__stats">
            <div>
              <div className="pick-book__big">{formatRecord(r)}</div>
              <div className="pick-book__label">Record</div>
            </div>
            <div>
              <div className={`pick-book__big ${r.pct >= BREAK_EVEN_PCT ? 'text-green' : ''}`}>{r.pct.toFixed(1)}%</div>
              <div className="pick-book__label">Win rate</div>
            </div>
            <div>
              <div className={`pick-book__big ${r.units > 0 ? 'text-green' : r.units < 0 ? 'text-red' : ''}`}>{formatUnits(r.units)}</div>
              <div className="pick-book__label">Units</div>
            </div>
          </div>
          <p className="pick-book__fine">
            {from && <>Since {from}. </>}
            1 unit a pick, ROI {r.roi > 0 ? '+' : ''}{r.roi}%. Break-even at -110 is {BREAK_EVEN_PCT}%.
            {r.assumedOdds > 0 && <> Graded at -110 for {r.assumedOdds} of {graded} picks with no recorded price.</>}
          </p>
          {sports.length > 0 && (
            <table className="pick-book__splits">
              <thead>
                <tr><th scope="col">Sport</th><th scope="col">Record</th><th scope="col">Win %</th><th scope="col">Units</th></tr>
              </thead>
              <tbody>
                {sports.map(s => (
                  <tr key={s.sport}>
                    <th scope="row">{s.sport}</th>
                    <td>{formatRecord(s)}</td>
                    <td>{s.pct.toFixed(1)}%</td>
                    <td className={s.units > 0 ? 'text-green' : s.units < 0 ? 'text-red' : ''}>{formatUnits(s.units)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}

/**
 * The two public records side by side (vault Decisions 2026-10-15). Both
 * always, never one: hiding either later would read as hiding results. Every
 * figure comes from lib/records.ts so this page and /win can never disagree,
 * and the full ledger is one click away, which is what keeps per-sport splits
 * honest.
 */
export default function PickRecords({ rows }: { rows: RecordSource[] }) {
  return (
    <div className="pick-records">
      <div className="pick-records__grid">
        <BookPanel book="free" rows={rows} />
        <BookPanel book="members" rows={rows} />
      </div>
      <p className="pick-records__ledger">
        Sports with fewer than {MIN_DECISIONS} decisions are left out of the splits.{' '}
        <Link href="/portfolio/performance">See every graded pick &rarr;</Link>
      </p>
    </div>
  )
}
