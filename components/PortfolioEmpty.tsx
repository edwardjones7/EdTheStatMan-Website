import Link from 'next/link'
import ProofStrip from './ProofStrip'
import type { ProofData } from '@/lib/proof'
import { OFFER_ENTRY_PRICE } from '@/lib/offer'
import { IconArrowRight } from './Icons'

/**
 * /portfolio with no open plays. This used to be one grey line and a row of
 * social links, which on a quiet day meant the page selling the picks pointed
 * a buyer off the site. Now it carries the record and two on-site next steps.
 * Server component, handed to the client TodaysBets as a node.
 */
export default function PortfolioEmpty({ proof, isMember }: { proof: ProofData; isMember: boolean }) {
  return (
    <div className="portfolio-empty">
      <p className="portfolio-empty__lead">
        {isMember
          ? 'No open plays right now. The card goes up the night before, and alerts go out by email, push and Discord when it does.'
          : 'No open plays right now. The card goes up the night before. Here is how the graded picks have done.'}
      </p>
      <ProofStrip proof={proof} />
      {!isMember && (
        <div className="portfolio-empty__actions">
          <Link href="/win" className="btn btn--primary">
            See Plans — from {OFFER_ENTRY_PRICE} <IconArrowRight size={16} />
          </Link>
          <Link href="/picks" className="btn btn--secondary">Get Free Picks</Link>
        </div>
      )}
    </div>
  )
}
