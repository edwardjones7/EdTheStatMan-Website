import Link from 'next/link'
import type { Brief } from '@/lib/brief'
import { formatCardDate, relativeLabel } from '@/lib/brief'
import { IconLock, IconArrowRight } from './Icons'

/**
 * The daily card, on the homepage.
 *
 * Server component on purpose — it renders entitlement-filtered content, and a
 * client component would mean shipping the gating decision (and the rows it
 * dropped) to the browser. Everything here is already resolved by
 * lib/brief.ts::buildBrief() before it arrives.
 *
 * `brief.visible` contains only picks this member may see; locked ones are a
 * count, never a redacted row, because a card of four grey bars reads worse
 * than an honest "2 more on this card".
 */
export default function TodaysBrief({ brief }: { brief: Brief }) {
  // Nothing scheduled and nothing graded — render nothing rather than an empty
  // shell. A blank section is worse than no section.
  if (!brief.date && !brief.record) return null

  const { date, visible, lockedCount, sportCounts, total, record } = brief

  return (
    <section className="section brief" aria-labelledby="brief-heading">
      <div className="container">
        <div className="brief__card reveal">

          <header className="brief__head">
            <div className="brief__eyebrow">
              <span className="brief__pip" aria-hidden="true" />
              {date ? relativeLabel(date) : 'The card'}
              {date && <span className="brief__date">{formatCardDate(date)}</span>}
            </div>
            <h2 id="brief-heading" className="brief__title">Today&rsquo;s Brief</h2>
          </header>

          {total > 0 ? (
            <p className="brief__summary">
              <strong>{total}</strong> {total === 1 ? 'play' : 'plays'} on the card
              {sportCounts.length > 0 && (
                <>
                  {' '}
                  {sportCounts.map(s => (
                    <span key={s.sport} className="brief__chip">{s.n} {s.sport}</span>
                  ))}
                </>
              )}
            </p>
          ) : (
            <p className="brief__summary brief__summary--quiet">
              No plays posted yet. The card goes up the night before.
            </p>
          )}

          {visible.length > 0 && (
            <ul className="brief__list">
              {visible.map(p => (
                <li key={p.id} className="brief__pick">
                  <span className="brief__sport">{p.sport}</span>
                  <span className="brief__play">
                    <span className="brief__bet">
                      {p.bet}
                      {p.line && <span className="brief__line">{p.line}</span>}
                    </span>
                    {p.opponent && (
                      <span className="brief__opp">vs {p.opponent}</span>
                    )}
                  </span>
                  {p.result && p.result.toLowerCase() !== 'pending' && (
                    <span className={`brief__result is-${p.result.toLowerCase()}`}>
                      {p.result}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {lockedCount > 0 && (
            <Link href="/win" className="brief__locked">
              <IconLock />
              <span>
                <strong>{lockedCount}</strong>{' '}
                {lockedCount === 1 ? 'more play' : 'more plays'} on this card
              </span>
              <span className="brief__unlock">Unlock <IconArrowRight /></span>
            </Link>
          )}

          <footer className="brief__foot">
            {record && (
              <span className="brief__record">
                Published record{' '}
                <strong>{record.w}&ndash;{record.l}{record.p > 0 ? `–${record.p}` : ''}</strong>
                <span className="brief__pct">({record.pct.toFixed(1)}%)</span>
              </span>
            )}
            <Link href="/portfolio" className="brief__more">
              The Portfolio <IconArrowRight />
            </Link>
          </footer>

        </div>
      </div>
    </section>
  )
}
