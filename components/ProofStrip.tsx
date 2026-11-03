import Link from 'next/link'
import '@/styles/proof-win.css'
import type { ProofData, ProofStat } from '@/lib/proof'
import { BOOK_LABEL, shortDate } from '@/lib/proof'
import { BREAK_EVEN_PCT } from '@/lib/records'
import { IconArrowRight } from './Icons'

/**
 * The record, as every selling surface states it.
 *
 * Server component taking precomputed data (lib/proof.ts) so no row ever
 * reaches the browser. Leads with the best in-season sport because that is the
 * honest strongest claim, and is only honest BECAUSE the per-sport splits, both
 * books and the full ledger sit right under it. Never render the headline
 * without the "See every pick" link: lib/records.ts headlineRecord() says the
 * same.
 *
 *   full     /win, /portfolio (empty), /portfolio/performance
 *   compact  the homepage brief footer, where the blended record used to be
 */
interface Props {
  proof: ProofData
  variant?: 'full' | 'compact'
  /** Hide the ledger link on the ledger page itself. */
  showLedgerLink?: boolean
  className?: string
}

function tone(pct: number): 'up' | 'even' | 'down' {
  // Keyed to break-even at -110, not 50%: a 51% sport is losing money.
  return pct >= BREAK_EVEN_PCT ? 'up' : pct >= 50 ? 'even' : 'down'
}

function BookLine({ label, s }: { label: string; s: ProofStat }) {
  return (
    <span className={`proof__book proof__book--${tone(s.pct)}`}>
      <span className="proof__book-label">{label}</span>{' '}
      <strong>{s.record}</strong>{' '}
      <span className="proof__book-meta">
        {s.pct.toFixed(1)}% &middot; {s.units}
      </span>
    </span>
  )
}

export default function ProofStrip({ proof, variant = 'full', showLedgerLink = true, className }: Props) {
  const { headline, headlineBook, headlineInSeason, sports, books } = proof
  if (!headline && !books.members && !books.free) return null

  // The chips are the same book as the headline, largest sample first --
  // recordsBySport()'s order, not best-first, so the strip cannot be read as
  // a highlight reel. The headline sport is not repeated.
  const chips = sports.filter(s => s.sport !== headline?.sport).slice(0, variant === 'compact' ? 3 : 4)

  const graded = (books.members?.graded ?? 0) + (books.free?.graded ?? 0)
  const assumed = (books.members?.assumedOdds ?? 0) + (books.free?.assumedOdds ?? 0)

  const ledger = showLedgerLink && (
    <Link href="/portfolio/performance" className="proof__ledger">
      See every pick <IconArrowRight size={14} />
    </Link>
  )

  return (
    <div className={['proof', `proof--${variant}`, className].filter(Boolean).join(' ')}>
      {headline && (
        <div className="proof__head">
          <span className="proof__eyebrow">
            {BOOK_LABEL[headlineBook]} &middot; {headlineInSeason ? 'best sport in season' : 'best sport'}
          </span>
          <span className="proof__headline">
            <span className="proof__sport">{headline.sport}</span>{' '}
            <span className={`proof__record proof__record--${tone(headline.pct)}`}>{headline.record}</span>
          </span>
          <span className="proof__sub">
            {headline.pct.toFixed(1)}% on {headline.w + headline.l} decisions
            {headline.from ? ` since ${shortDate(headline.from)}` : ''}
            {' '}&middot; {headline.units}
          </span>
        </div>
      )}

      {chips.length > 0 && (
        <ul className="proof__chips" aria-label={`${BOOK_LABEL[headlineBook]} by sport`}>
          {chips.map(s => (
            <li key={s.sport} className={`proof__chip proof__chip--${tone(s.pct)}`}>
              <span className="proof__chip-sport">{s.sport}</span>
              <span className="proof__chip-record">{s.record}</span>
              <span className="proof__chip-pct">{s.pct.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      )}

      <div className="proof__books">
        {books.members && <BookLine label={BOOK_LABEL.members} s={books.members} />}
        {books.free && <BookLine label={BOOK_LABEL.free} s={books.free} />}
      </div>

      <div className="proof__foot">
        {variant === 'full' && graded > 0 && (
          <p className="proof__note">
            One unit per pick, at the posted odds
            {assumed > 0 ? `; ${assumed} of ${graded} graded picks have no recorded price and are scored at -110` : ''}.
            Break-even at -110 is {BREAK_EVEN_PCT}%.
          </p>
        )}
        {ledger}
      </div>
    </div>
  )
}
