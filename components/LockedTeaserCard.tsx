'use client'

// A client component since it records the click on a free row's signup link.
// Every prop is plain data, so the server-rendered Desk page can still use it.
//
// Built to read as a real row, not a hole: the sport, the record, the win rate
// as a bar and the sample size are all on it, with a lock where the rule would
// be and an Unlock button at the end. Every one of those numbers is already in
// the LockedTeaser (lib/teaser.ts); nothing here may need more than that type
// carries, and the rule itself never reaches the browser.
import Link from 'next/link'
import { IconLock } from './Icons'
import type { LockedTeaser } from '@/lib/teaser'
import type { Tier } from '@/lib/access'
import { unlockHref } from '@/lib/unlock'
import { trackEvent } from '@/lib/track-client'
import PaywallView from './PaywallView'
import '@/styles/front-door.css'
import '@/styles/vault-list.css'

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
  /** What the row is, for the label and the screen-reader text. */
  noun?: 'system' | 'trend'
}

function pctDisplay(pct: number | null) {
  if (pct === null) return '—'
  return `${Math.round(pct * 100)}%`
}

export default function LockedTeaserCard({ teaser, sportLabel, sportClass, variant = 'members', requiredTier, freeWithAccount = false, signupNext = '/', noun = 'system' }: Props) {
  const winning = teaser.w > teaser.l
  const elite = variant === 'elite' && !freeWithAccount
  const tier: Tier | undefined = freeWithAccount ? 'retail' : requiredTier ?? (elite ? 'private' : undefined)
  const href = freeWithAccount ? `/signup?next=${encodeURIComponent(signupNext)}` : unlockHref(tier)
  const sample = teaser.w + teaser.l + teaser.t
  const decided = teaser.w + teaser.l
  // The bar is the share of decided games won; the stored pct when present.
  const share = teaser.pct ?? (decided > 0 ? teaser.w / decided : null)
  const width = share === null ? 0 : Math.max(0, Math.min(100, share * 100))
  const kind = freeWithAccount
    ? `Free ${noun}`
    : elite ? `Highest-conviction ${noun}` : `Vault ${noun}`
  const cta = freeWithAccount ? 'Sign up free' : 'Unlock'

  return (
    <Link
      href={href}
      onClick={freeWithAccount ? () => trackEvent('signup_prompt_click', { context: 'vault_free_row', variant: 'lock' }) : undefined}
      className={`sys-row-card sys-row-card--${sportClass} sys-row-card--teaser vl-lock${elite ? ' sys-row-card--elite-teaser vl-lock--elite' : ''}${freeWithAccount ? ' sys-row-card--free-teaser vl-lock--free' : ''}`}
      aria-label={`Locked ${kind.toLowerCase()}, ${sportLabel}, record ${teaser.w}-${teaser.l}-${teaser.t} over ${sample} games. ${freeWithAccount ? 'Create a free account to see it.' : `Unlock to see the ${noun}.`}`}
    >
      {/* Once per page per gate kind, however many cards render (PaywallView). */}
      <PaywallView gate={freeWithAccount ? 'vault_free_row' : 'vault_row'} tier={tier ?? null} />
      <div className="vl-lock__body">
        <span className="sys-row-card__sport-badge vl-lock__sport">{sportLabel}</span>

        <span className="vl-lock__main">
          <span className="vl-lock__kind">
            <IconLock size={12} /> {kind}
          </span>
          <span className="vl-lock__meta">
            <b>{sample.toLocaleString()}</b> {sample === 1 ? 'game' : 'games'} on record · rule hidden
          </span>
        </span>

        <span className="vl-lock__stat">
          <span className="vl-lock__key">Record</span>
          <span className={`vl-lock__rec vl-lock__rec--${winning ? 'win' : teaser.w < teaser.l ? 'loss' : 'flat'}`}>
            {teaser.w}-{teaser.l}{teaser.t ? `-${teaser.t}` : ''}
          </span>
        </span>

        <span className="vl-lock__stat vl-lock__stat--pct">
          <span className="vl-lock__key">Win %</span>
          <span className={`vl-lock__pct${winning ? ' is-win' : ''}`}>{pctDisplay(share)}</span>
          <span className="vl-lock__bar" aria-hidden="true">
            <span className={`vl-lock__fill${winning ? ' is-win' : ''}`} style={{ width: `${width}%` }} />
          </span>
        </span>

        <span className="vl-lock__cta">
          <IconLock size={12} /> {cta}
        </span>
      </div>
    </Link>
  )
}
