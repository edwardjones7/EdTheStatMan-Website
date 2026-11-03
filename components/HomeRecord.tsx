import Link from 'next/link'
import type { ProofData, ProofStat } from '@/lib/proof'
import { BOOK_LABEL, shortDate } from '@/lib/proof'
import { minus } from '@/lib/home-board'

/**
 * The record as a quote strip under the homepage hero.
 *
 * Every figure is lib/proof.ts (which is lib/records.ts). Same rules as
 * ProofStrip: the headline sport never appears without both books beside it
 * and the link to every graded pick, so a good stretch cannot pass as the
 * whole record.
 */
function Quote({ label, s, note }: { label: string; s: ProofStat; note?: string }) {
  const tone = s.unitsValue > 0 ? 'up' : s.unitsValue < 0 ? 'down' : 'flat'
  return (
    <div className="home-record__quote">
      <span className="home-record__label">{label}</span>
      <span className="home-record__figure">
        {s.record}{' '}
        <span className={`home-record__units is-${tone}`}>{minus(s.units)}</span>
      </span>
      <span className="home-record__meta">
        {s.pct.toFixed(1)}%{note ? `, ${note}` : ''}
      </span>
    </div>
  )
}

export default function HomeRecord({ proof }: { proof: ProofData }) {
  const { headline, headlineBook, headlineInSeason, books } = proof
  if (!headline && !books.members && !books.free) return null

  const book = BOOK_LABEL[headlineBook]
  const since = headline?.from ? `since ${shortDate(headline.from)}` : undefined

  return (
    <section className="home-record" id="record" aria-label="The record">
      <div className="container home-record__inner">
        {headline && (
          <Quote
            label={`${book}, ${headline.sport}`}
            s={headline}
            note={[headlineInSeason ? 'best sport in season' : 'best sport', since].filter(Boolean).join(' ')}
          />
        )}
        {books.members && <Quote label={`${BOOK_LABEL.members}, all sports`} s={books.members} />}
        {books.free && <Quote label={`${BOOK_LABEL.free}, all sports`} s={books.free} />}
        <p className="home-record__note">
          One unit per pick. Every graded pick is listed with its date, line and result,
          wins and losses alike.
        </p>
        <Link href="/portfolio/performance" className="home-record__link">Every pick</Link>
      </div>
    </section>
  )
}
