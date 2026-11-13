import Link from 'next/link'
import UnitsChart from '@/components/UnitsChart'
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
import { nyToday } from '@/lib/brief'
import { calendarMonth, unitsSeries } from '@/lib/results'

/**
 * The top of /portfolio/performance: each sport as its own story first (record,
 * win rate, units, its own running line), the whole record beside it and never
 * hidden, then the running-units chart and a month calendar.
 *
 * Server component over rows already in hand. Every number comes from
 * lib/records.ts (via lib/results.ts for the series), the same maths as the
 * ledger underneath, so the page cannot disagree with itself. Graded published
 * picks are public, and nothing here renders the pick text anyway.
 */

type Row = RecordSource & { created_at?: string | null }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function graded(r: Pick<PickRecord, "w" | "l" | "p">) {
  return r.w + r.l + r.p
}

function tone(pct: number) {
  return pct >= BREAK_EVEN_PCT ? 'up' : pct >= 50 ? 'even' : 'down'
}

function minus(s: string) {
  return s.replace(/-/g, '−')
}

function signed(u: number, d = 1) {
  return `${u > 0 ? '+' : u < 0 ? '−' : ''}${Math.abs(u).toFixed(d)}u`
}

function query(params: Record<string, string | null>, hash: string) {
  const q = Object.entries(params).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join('&')
  return `/portfolio/performance${q ? `?${q}` : ''}#${hash}`
}

function level(u: number): 1 | 2 | 3 {
  const a = Math.abs(u)
  return a >= 2.5 ? 3 : a >= 1 ? 2 : 1
}

export default function ResultsOverview({ rows, month, sport }: { rows: Row[]; month: string; sport: string | null }) {
  const total = computeRecord(rows)
  const books = recordsByBook(rows)
  const bookKeys = (['members', 'free'] as const).filter(b => graded(books[b]) > 0)
  const sports = sportSeasonBreakdown(rows)
  const sportRows = (s: string) => rows.filter(r => String(r.sport ?? '').trim().toUpperCase() === s)

  const chartSport = sport && sports.some(s => s.sport === sport) ? sport : null
  const chartRows = chartSport ? sportRows(chartSport) : rows
  const chartRecord = chartSport ? sports.find(s => s.sport === chartSport)! : total
  const series = unitsSeries(chartRows)

  const thisMonth = nyToday().slice(0, 7)
  const cal = calendarMonth(rows, month)
  const today = nyToday()

  if (graded(total) === 0) {
    return (
      <section className="rs-wrap">
        <header className="rs-head">
          <span className="pf-kick">Live track record</span>
          <h1>Model results</h1>
          <p>No graded picks yet. Every pick lands here once it is graded, win or lose.</p>
        </header>
      </section>
    )
  }

  return (
    <div className="rs-wrap">
      <header className="rs-head">
        <span className="pf-kick">Live track record</span>
        <h1>Model results</h1>
        <p>
          Every graded pick, win or lose. Each sport is its own record, so it leads; the total
          across all of them sits beside it, and the full log is underneath.
        </p>
      </header>

      <div className="rs-grid">
        <section className="rs-sports" aria-labelledby="rs-sports-hd">
          <h2 id="rs-sports-hd" className="rs-label">By sport</h2>
          <div className="rs-sports__grid">
            {sports.map(sp => {
              const s = unitsSeries(sportRows(sp.sport))
              return (
                <article key={sp.sport} className={`rs-sport rs-sport--${sp.units >= 0 ? 'up' : 'down'}`}>
                  <header className="rs-sport__hd">
                    <h3>{sp.sport}</h3>
                    <span>{graded(sp)} graded{sp.from ? ` · since ${shortDate(sp.from)}` : ''}</span>
                  </header>
                  <div className="rs-sport__big">
                    <b>{formatRecord(sp)}</b>
                    <span className={sp.units >= 0 ? 'pf-up' : 'pf-down'}>{minus(formatUnits(sp.units))}</span>
                  </div>
                  <dl className="rs-sport__stats">
                    <div><dt>Win rate</dt><dd className={`rs-tone--${tone(sp.pct)}`}>{sp.pct.toFixed(1)}%</dd></div>
                    <div><dt>ROI</dt><dd>{sp.roi > 0 ? '+' : sp.roi < 0 ? '−' : ''}{Math.abs(sp.roi).toFixed(1)}%</dd></div>
                  </dl>
                  <UnitsChart series={s.points} last={sp.units} spark className="rs-spark" gradientId={`rs-spark-${sp.sport}`} />
                  {sp.seasons.length > 1 && (
                    <ul className="rs-seasons" aria-label={`${sp.sport} by season`}>
                      {sp.seasons.map(se => (
                        <li key={se.season}>
                          <span>{se.season}</span>
                          <span>{formatRecord(se)}</span>
                          <span className={`rs-tone--${tone(se.pct)}`}>{se.pct.toFixed(1)}%</span>
                          <span className={se.units >= 0 ? 'pf-up' : 'pf-down'}>{minus(formatUnits(se.units))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link href={query({ sport: sp.sport, month: month === thisMonth ? null : month }, 'units')} className="rs-sport__link">
                    Chart {sp.sport}
                  </Link>
                </article>
              )
            })}
          </div>
        </section>

        <aside className="rs-overall" aria-labelledby="rs-overall-hd">
          <h2 id="rs-overall-hd" className="rs-label">All sports, every pick</h2>
          <div className="pf-panel rs-overall__card">
            <div className="rs-sport__big">
              <b>{formatRecord(total)}</b>
              <span className={total.units >= 0 ? 'pf-up' : 'pf-down'}>{minus(formatUnits(total.units))}</span>
            </div>
            <dl className="rs-sport__stats">
              <div><dt>Win rate</dt><dd className={`rs-tone--${tone(total.pct)}`}>{total.pct.toFixed(1)}%</dd></div>
              <div><dt>ROI</dt><dd>{total.roi > 0 ? '+' : total.roi < 0 ? '−' : ''}{Math.abs(total.roi).toFixed(1)}%</dd></div>
              <div><dt>Graded</dt><dd>{graded(total)}</dd></div>
            </dl>
            {bookKeys.length > 1 && (
              <ul className="rs-seasons rs-books">
                {bookKeys.map(b => (
                  <li key={b}>
                    <span>{BOOK_LABEL[b]}</span>
                    <span>{formatRecord(books[b])}</span>
                    <span className={`rs-tone--${tone(books[b].pct)}`}>{books[b].pct.toFixed(1)}%</span>
                    <span className={books[b].units >= 0 ? 'pf-up' : 'pf-down'}>{minus(formatUnits(books[b].units))}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="rs-note">
              {total.from ? `Since ${shortDate(total.from)}. ` : ''}
              One unit risked per pick{total.assumedOdds > 0 ? `; ${total.assumedOdds} with no recorded price scored at −110` : ''}.
              Break-even at −110 is {BREAK_EVEN_PCT}%.
            </p>
          </div>
        </aside>
      </div>

      <section className="pf-panel rs-chart" id="units" aria-labelledby="rs-chart-hd">
        <header className="pf-panel__hd">
          <h2 id="rs-chart-hd">Units over time · {chartSport ?? 'All sports'}</h2>
          <span className={chartRecord.units >= 0 ? 'pf-up' : 'pf-down'}>{minus(formatUnits(chartRecord.units))} · {formatRecord(chartRecord)}</span>
        </header>
        <nav className="rs-chips" aria-label="Chart a sport">
          <Link href={query({ month: month === thisMonth ? null : month }, 'units')} className={!chartSport ? 'is-on' : undefined}>All</Link>
          {sports.map(sp => (
            <Link key={sp.sport} href={query({ sport: sp.sport, month: month === thisMonth ? null : month }, 'units')} className={chartSport === sp.sport ? 'is-on' : undefined}>
              {sp.sport}
            </Link>
          ))}
        </nav>
        {series.points.length > 2 ? (
          <UnitsChart
            series={series.points}
            last={chartRecord.units}
            className="rs-chart__svg"
            gradientId="rs-chart-fill"
            width={900}
            height={240}
            labels={[shortDate(series.first), shortDate(series.last)]}
          />
        ) : (
          <p className="pf-empty__line">Not enough graded picks to chart yet.</p>
        )}
      </section>

      <section className="pf-panel rs-cal" id="calendar" aria-labelledby="rs-cal-hd">
        <header className="pf-panel__hd rs-cal__hd">
          <Link href={query({ month: cal.prev, sport: chartSport }, 'calendar')} className="rs-cal__nav" aria-label="Previous month">&larr;</Link>
          <h2 id="rs-cal-hd">{cal.label}</h2>
          {cal.next <= thisMonth
            ? <Link href={query({ month: cal.next === thisMonth ? null : cal.next, sport: chartSport }, 'calendar')} className="rs-cal__nav" aria-label="Next month">&rarr;</Link>
            : <span className="rs-cal__nav is-off" aria-hidden>&rarr;</span>}
          <span className="rs-cal__tot">
            {graded(cal.totals) > 0
              ? <>{formatRecord(cal.totals)} · <span className={cal.totals.units >= 0 ? 'pf-up' : 'pf-down'}>{signed(cal.totals.units, 2)}</span></>
              : 'No graded picks'}
          </span>
        </header>
        <div className="rs-cal__grid" role="table" aria-label={`Results by day, ${cal.label}`}>
          <div className="rs-cal__row" role="row">
            {WEEKDAYS.map(d => <span key={d} className="rs-cal__wd" role="columnheader">{d}</span>)}
          </div>
          <div className="rs-cal__days" role="rowgroup">
            {Array.from({ length: cal.lead }, (_, i) => <span key={`b${i}`} className="rs-day is-blank" aria-hidden />)}
            {cal.days.map(d => {
              const n = d.w + d.l + d.p
              const t = n === 0 ? '' : d.units > 0 ? ` is-up is-l${level(d.units)}` : d.units < 0 ? ` is-down is-l${level(d.units)}` : ' is-flat'
              return (
                <span
                  key={d.date}
                  role="cell"
                  className={`rs-day${t}${d.date === today ? ' is-today' : ''}`}
                  title={n ? `${d.date}: ${formatRecord(d)}, ${signed(d.units, 2)}` : undefined}
                >
                  <i>{d.day}</i>
                  {n > 0 && (
                    <>
                      <b>{formatRecord(d)}</b>
                      <small>{signed(d.units)}</small>
                    </>
                  )}
                </span>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
