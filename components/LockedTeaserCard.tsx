'use client'

// A client component since it records the click on a free row's signup link.
// Every prop is plain data, so the server-rendered Desk page can still use it.
import Link from 'next/link'
import RecordStrip from './RecordStrip'
import { IconLock } from './Icons'
import type { LockedTeaser } from '@/lib/teaser'
import type { Tier } from '@/lib/access'
import { unlockHref } from '@/lib/unlock'
import { trackEvent } from '@/lib/track-client'
import PaywallView from './PaywallView'
import '@/styles/front-door.css'

interface Props {
  /** Narrow type on purpose: a full row must never be passable here. */
  teaser: LockedTeaser
  sportLabel: string
  sportClass: string
  /** 'elite' renders the gold Elite-locked treatment; default is members-locked. */
  variant?: 'members' | 'elite'
  /**
   * The rung that opens this row, when the caller knows it. Drives the /win
   * deep link. Without it an elite card still knows (Institutional) and a
   * members card falls back to plain /win.
   */
  requiredTier?: Tier
  /**
   * A FREE row shown locked to a logged-out visitor. It opens with a free
   * account, so it links to signup (back to this page), not to a price.
   */
  freeWithAccount?: boolean
  /** Signup's `next` for a freeWithAccount card. Required with it. */
  signupNext?: string
}

function pctDisplay(pct: number | null) {
  if (pct === null) return '—'
  return `${Math.round(pct * 100)}%`
}

export default function LockedTeaserCard({ teaser, sportLabel, sportClass, variant = 'members', requiredTier, freeWithAccount = false, signupNext = '/' }: Props) {
  const winning = teaser.w > teaser.l
  const elite = variant === 'elite' && !freeWithAccount
  const tier: Tier | undefined = freeWithAccount ? 'retail' : requiredTier ?? (elite ? 'private' : undefined)
  const href = freeWithAccount ? `/signup?next=${encodeURIComponent(signupNext)}` : unlockHref(tier)
  const hint = freeWithAccount
    ? 'Free with an account — sign up to see it'
    : elite ? 'Highest-conviction — unlock with the Vault' : 'Unlock to see the system'

  return (
    <Link
      href={href}
      onClick={freeWithAccount ? () => trackEvent('signup_prompt_click', { context: 'vault_free_row', variant: 'lock' }) : undefined}
      className={`sys-row-card sys-row-card--${sportClass} sys-row-card--teaser${elite ? ' sys-row-card--elite-teaser' : ''}${freeWithAccount ? ' sys-row-card--free-teaser' : ''}`}
      aria-label={`Locked ${elite ? 'highest-conviction ' : freeWithAccount ? 'free ' : ''}system — ${sportLabel}, record ${teaser.w}-${teaser.l}-${teaser.t}. ${freeWithAccount ? 'Create a free account to see it.' : 'Unlock to see the system.'}`}
    >
      {/* Once per page per gate kind, however many cards render (PaywallView). */}
      <PaywallView gate={freeWithAccount ? 'vault_free_row' : 'vault_row'} tier={tier ?? null} />
      <div className="sys-row-card__body">
        <div className="sys-row-card__sport-col">
          <span className="sys-row-card__sport-badge">{sportLabel}</span>
        </div>

        <div className="sys-row-card__desc-col">
          {/* Decorative only — the description never reaches the client. */}
          <span className="sys-row-card__redacted" aria-hidden="true" />
          <span className={`sys-row-card__teaser-hint${elite ? ' sys-row-card__teaser-hint--elite' : ''}`}>
            <IconLock size={12} /> {hint}
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
