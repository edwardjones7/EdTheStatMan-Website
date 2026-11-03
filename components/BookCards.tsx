import '@/styles/proof-win.css'
import { recordsBySport, bookOf, BREAK_EVEN_PCT, formatRecord, formatUnits, MIN_DECISIONS, type Book, type RecordSource } from '@/lib/records'
import { BOOK_LABEL, shortDate, type ProofData } from '@/lib/proof'

/**
 * The two records side by side, each with its own per-sport split, on
 * /portfolio/performance. Same rows and the same lib/records.ts maths as the
 * proof strip above it, so the page cannot disagree with itself. Both books
 * render whenever they have a graded pick: the free book beating the members'
 * card would argue against upgrading, and hiding it then would be the lie.
 */
const BOOK_BLURB: Record<Book, string> = {
  members: 'The paid card: what The Portfolio and every rung above it unlock.',
  free: 'Picks given away free, open to everyone.',
}

function tone(pct: number) {
  return pct >= BREAK_EVEN_PCT ? 'up' : pct >= 50 ? 'even' : 'down'
}

export default function BookCards({ proof, rows }: { proof: ProofData; rows: RecordSource[] }) {
  const books: Book[] = ['members', 'free']
  const shown = books.filter(b => proof.books[b])
  if (shown.length === 0) return null

  return (
    <section className="section books" aria-labelledby="books-heading">
      <div className="container">
        <h2 id="books-heading" className="books__title">
          {shown.length > 1 ? 'Two records, kept apart' : 'The record, by sport'}
        </h2>
        <div className={`books__grid${shown.length === 1 ? ' books__grid--single' : ''}`}>
          {shown.map(b => {
            const s = proof.books[b]!
            const sports = recordsBySport(rows.filter(r => bookOf(r) === b))
            return (
              <article key={b} className={`book-card book-card--${b}`}>
                <header className="book-card__head">
                  <h3 className="book-card__name">{BOOK_LABEL[b]}</h3>
                  <p className="book-card__blurb">{BOOK_BLURB[b]}</p>
                </header>
                <div className="book-card__stats">
                  <div className="book-card__stat">
                    <span className="book-card__value">{s.record}</span>
                    <span className="book-card__label">Record</span>
                  </div>
                  <div className="book-card__stat">
                    <span className={`book-card__value book-card__value--${tone(s.pct)}`}>{s.pct.toFixed(1)}%</span>
                    <span className="book-card__label">Win rate</span>
                  </div>
                  <div className="book-card__stat">
                    <span className="book-card__value">{s.units}</span>
                    <span className="book-card__label">Units</span>
                  </div>
                </div>
                <p className="book-card__meta">
                  {s.graded} graded{s.from ? ` since ${shortDate(s.from)}` : ''}
                  {s.assumedOdds > 0 ? ` · ${s.assumedOdds} scored at -110 (no recorded price)` : ''}
                </p>
                {sports.length > 0 && (
                  <ul className="book-card__sports">
                    {sports.map(sp => (
                      <li key={sp.sport} className={`book-card__sport book-card__sport--${tone(sp.pct)}`}>
                        <span className="book-card__sport-name">{sp.sport}</span>
                        <span className="book-card__sport-rec">{formatRecord(sp)}</span>
                        <span className="book-card__sport-pct">{sp.pct.toFixed(1)}%</span>
                        <span className="book-card__sport-u">{formatUnits(sp.units)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="book-card__floor">Sports with {MIN_DECISIONS}+ decisions. The record above counts every sport.</p>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
