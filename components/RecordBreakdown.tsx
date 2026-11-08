import '@/styles/proof-win.css'
import {
  computeRecord,
  recordsByBook,
  sportSeasonBreakdown,
  formatRecord,
  formatUnits,
  BREAK_EVEN_PCT,
  type PickRecord,
  type RecordSource,
} from '@/lib/records'
import { BOOK_LABEL, shortDate } from '@/lib/proof'

/**
 * The record on /portfolio/performance, top down:
 *   1. the total across every graded pick (members' card + free picks), with
 *      the two books shown beside it so neither can hide inside the blend
 *   2. each sport's overall
 *   3. each sport split by season (lib/records.ts seasonOf)
 *
 * Pure server component over rows already in hand; same lib/records.ts maths
 * as the ledger below it, so the page cannot disagree with itself.
 */

function tone(pct: number) {
  return pct >= BREAK_EVEN_PCT ? 'up' : pct >= 50 ? 'even' : 'down'
}

function graded(r: PickRecord) {
  return r.w + r.l + r.p
}

function Stat({ value, label, toneClass }: { value: string; label: string; toneClass?: string }) {
  return (
    <div className="rb-stat">
      <span className={`rb-stat__value${toneClass ? ` rb-stat__value--${toneClass}` : ''}`}>{value}</span>
      <span className="rb-stat__label">{label}</span>
    </div>
  )
}

export default function RecordBreakdown({ rows }: { rows: RecordSource[] }) {
  const total = computeRecord(rows)
  if (graded(total) === 0) return null
  const books = recordsByBook(rows)
  const sports = sportSeasonBreakdown(rows)

  return (
    <section className="section rb" aria-labelledby="rb-heading">
      <div className="container">
        <article className="rb-total">
          <header className="rb-total__head">
            <span className="section-label">Total</span>
            <h2 id="rb-heading" className="rb-total__title">Overall record</h2>
          </header>
          <div className="rb-total__stats">
            <Stat value={formatRecord(total)} label="Record" />
            <Stat value={`${total.pct.toFixed(1)}%`} label="Win rate" toneClass={tone(total.pct)} />
            <Stat value={formatUnits(total.units)} label="Units" />
            <Stat value={`${total.roi > 0 ? '+' : ''}${total.roi.toFixed(1)}%`} label="ROI" />
          </div>
          <p className="rb-meta">
            {graded(total)} graded{total.from ? ` since ${shortDate(total.from)}` : ''}
            {total.assumedOdds > 0 ? ` · ${total.assumedOdds} scored at -110 (no recorded price)` : ''}
            {` · break-even at -110 is ${BREAK_EVEN_PCT}%`}
          </p>
          <ul className="rb-books">
            {(['members', 'free'] as const).filter(b => graded(books[b]) > 0).map(b => (
              <li key={b} className={`rb-row rb-row--${tone(books[b].pct)}`}>
                <span className="rb-row__name">{BOOK_LABEL[b]}</span>
                <span className="rb-row__rec">{formatRecord(books[b])}</span>
                <span className="rb-row__pct">{books[b].pct.toFixed(1)}%</span>
                <span className="rb-row__u">{formatUnits(books[b].units)}</span>
              </li>
            ))}
          </ul>
        </article>

        {sports.length > 0 && (
          <>
            <h2 className="rb-sports__title">By sport</h2>
            <div className="rb-sports">
              {sports.map(sp => (
                <article key={sp.sport} className="rb-sport">
                  <header className="rb-sport__head">
                    <h3 className="rb-sport__name">{sp.sport}</h3>
                    <span className="rb-sport__count">{graded(sp)} graded</span>
                  </header>
                  <div className="rb-sport__stats">
                    <Stat value={formatRecord(sp)} label="Record" />
                    <Stat value={`${sp.pct.toFixed(1)}%`} label="Win rate" toneClass={tone(sp.pct)} />
                    <Stat value={formatUnits(sp.units)} label="Units" />
                  </div>
                  <ul className="rb-seasons" aria-label={`${sp.sport} by season`}>
                    {sp.seasons.map(se => (
                      <li key={se.season} className={`rb-row rb-row--${tone(se.pct)}`}>
                        <span className="rb-row__name">{se.season === 'Undated' ? se.season : `${se.season} season`}</span>
                        <span className="rb-row__rec">{formatRecord(se)}</span>
                        <span className="rb-row__pct">{se.pct.toFixed(1)}%</span>
                        <span className="rb-row__u">{formatUnits(se.units)}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
