import Link from 'next/link'
import RecordStrip from './RecordStrip'
import { IconLock } from './Icons'
import type { LockedTeaser } from '@/lib/teaser'

interface Props {
  /** Narrow type on purpose: a full row must never be passable here. */
  teaser: LockedTeaser
  sportLabel: string
  sportClass: string
  /** 'elite' renders the gold Elite-locked treatment; default is members-locked. */
  variant?: 'members' | 'elite'
}

function pctDisplay(pct: number | null) {
  if (pct === null) return '—'
  return `${Math.round(pct * 100)}%`
}

export default function LockedTeaserCard({ teaser, sportLabel, sportClass, variant = 'members' }: Props) {
  const winning = teaser.w > teaser.l
  const elite = variant === 'elite'

  return (
    <Link
      href="/win"
      className={`sys-row-card sys-row-card--${sportClass} sys-row-card--teaser${elite ? ' sys-row-card--elite-teaser' : ''}`}
      aria-label={`Locked ${elite ? 'Elite ' : ''}system — ${sportLabel}, record ${teaser.w}-${teaser.l}-${teaser.t}. Unlock to see the system.`}
    >
      <div className="sys-row-card__body">
        <div className="sys-row-card__sport-col">
          <span className="sys-row-card__sport-badge">{sportLabel}</span>
        </div>

        <div className="sys-row-card__desc-col">
          {/* Decorative only — the description never reaches the client. */}
          <span className="sys-row-card__redacted" aria-hidden="true" />
          <span className={`sys-row-card__teaser-hint${elite ? ' sys-row-card__teaser-hint--elite' : ''}`}>
            <IconLock size={12} /> {elite ? 'Elite only — go Elite to unlock' : 'Unlock to see the system'}
          </span>
        </div>

        <div className="sys-row-card__field">
          <span className="sys-row-card__field-label">Record</span>
          <span
            className={`sys-row-card__record sys-row-card__record--${
              winning ? 'win' : teaser.w < teaser.l ? 'loss' : 'neutral'
            }`}
          >
            {teaser.w}-{teaser.l}-{teaser.t}
          </span>
        </div>

        <div className="sys-row-card__pct-col">
          <span className={`sys-row-card__pct sys-row-card__pct--${winning ? 'win' : 'neutral'}`}>
            {pctDisplay(teaser.pct)}
          </span>
          <RecordStrip w={teaser.w} l={teaser.l} t={teaser.t} />
        </div>
      </div>
    </Link>
  )
}
