import Link from 'next/link'
import { formatOdds } from '@/lib/picks/slug'
import type { PublicPick } from '@/lib/picks/public'

const RESULT_LABEL: Record<string, string> = { win: 'Win', loss: 'Loss', push: 'Push', pending: 'Pending' }

/** "Oct 15" from YYYY-MM-DD, read at noon UTC so it never slips a day in NY. */
export function shortDate(date: string | null): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date ?? ''
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

export function ResultBadge({ result }: { result: string }) {
  return <span className={`pick-result pick-result--${result}`}>{RESULT_LABEL[result] ?? result}</span>
}

/** One pick in a list. Server component; links to the pick's own page. */
export default function PickCard({ pick }: { pick: PublicPick }) {
  const price = formatOdds(pick.odds)
  return (
    <Link href={`/picks/${encodeURIComponent(pick.key)}`} className="pick-card">
      <div className="pick-card__meta">
        <span className={`pick-sport pick-sport--${pick.sport.toLowerCase()}`}>{pick.sport}</span>
        <span className="pick-card__date">{shortDate(pick.date)}</span>
        {pick.market === 'prop' && <span className="pick-card__tag">Prop</span>}
      </div>
      <div className="pick-card__bet">
        {pick.locked ? <span className="pick-card__locked">Members&apos; pick</span> : pick.bet}
        {price && <span className="pick-card__price">{price}</span>}
      </div>
      {pick.opponent && <div className="pick-card__opp">vs {pick.opponent}</div>}
      <div className="pick-card__foot">
        <ResultBadge result={pick.result} />
      </div>
    </Link>
  )
}
