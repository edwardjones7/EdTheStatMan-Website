'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import '@/styles/proof-win.css'
import '@/styles/rate-sheet.css'
import CheckoutButton from './CheckoutButton'
import TrialButton from './TrialButton'
import { OFFER_PLANS, OFFER_FREE_FEATURES } from '@/lib/offer'
import type { OfferPlan, OfferTierKey, BillingPeriod } from '@/lib/offer'
import { normalizeTier, type Membership, type Tier } from '@/lib/access'

interface Props {
  membership: Membership
  currentTier: Tier | null
  /** Include the free (Public Intelligence) comparison column (offer page only). */
  showFree?: boolean
  highlight?: OfferTierKey
  /** Unused since the Nov 2026 pricing; kept so callers need not change. */
  expiresAt?: string | null
  /** Show the free-trial button on the Research Desk row (lib/trial.ts). */
  trial?: { available: boolean; onTrial: boolean } | null
}

/**
 * What to show on a plan row for this member. Shared with WinPlans, and the
 * same rules app/api/stripe/checkout enforces, so a button is never offered
 * that the server would refuse.
 *
 *   'current'  they hold this product and are looking at the 30-day option
 *              (a second 30 days on top of a live 30 is refused: an
 *              accidental double buy is the dispute we never want)
 *   'extend'   they hold this product; 365 days stacks on what they have
 *   'buy'      offer it
 *   'hide'     already covered (Desk holders), or the sibling product. A
 *              Vault member is pointed at the Research Desk, not at the
 *              Portfolio, because the pass slot holds one product.
 *
 * A member on the free trial is offered everything: the trial is not a sale.
 */
export function cardState(
  currentTier: Tier | null,
  isPaid: boolean,
  plan: OfferPlan,
  period: BillingPeriod,
  onTrial = false,
): 'current' | 'extend' | 'buy' | 'hide' {
  if (!isPaid || !currentTier || onTrial) return 'buy'
  const held = normalizeTier(currentTier)
  if (plan.key === held) return period === 'year' ? 'extend' : 'current'
  if (plan.key === 'desk') return 'buy'
  return 'hide'
}

/**
 * Dollars saved by one 365-day pass against twelve 30-day ones, from the SKU
 * amounts in lib/offer.ts. Never typed in: it moves with the prices.
 */
export function annualSavingsDollars(plan: OfferPlan): number {
  return Math.max(0, plan.month.amount * 12 - plan.year.amount)
}

const usd = (n: number) => `$${n.toLocaleString('en-US')}`

/** The 30-day / 365-day switch. Shared by every rate sheet. */
export function PeriodToggle({
  period,
  onChange,
}: {
  period: BillingPeriod
  onChange: (next: BillingPeriod) => void
}) {
  return (
    <div className="rate-toggle" role="group" aria-label="Access period">
      <button
        type="button"
        className={`rate-toggle__opt${period === 'month' ? ' is-active' : ''}`}
        onClick={() => onChange('month')}
        aria-pressed={period === 'month'}
      >
        30-Day Access
      </button>
      <button
        type="button"
        className={`rate-toggle__opt${period === 'year' ? ' is-active' : ''}`}
        onClick={() => onChange('year')}
        aria-pressed={period === 'year'}
      >
        365-Day Access
      </button>
    </div>
  )
}

export interface RateSheetProps {
  plans: OfferPlan[]
  period: BillingPeriod
  stateOf: (plan: OfferPlan) => 'current' | 'extend' | 'buy' | 'hide'
  /** Gets the filled (brand blue) button. The Research Desk stays the lead row regardless. */
  highlight: OfferTierKey
  /** Marked "Your pick" (/win ?plan=). */
  picked?: OfferTierKey | null
  isExpired: boolean
  /** Extra controls under a row's buy button (the trial on the Research Desk). */
  extra?: (plan: OfferPlan) => ReactNode
  /** id on each row, for ?plan= scrolling on /win. */
  idFor?: (plan: OfferPlan) => string
}

/**
 * One rate sheet, not three cards. The Research Desk is the lead row: first,
 * wider, on the card surface under the brand-blue rule. The others are columns of
 * the same sheet, split by hairlines. Below 900px the rows stack.
 */
export function RateSheet({ plans, period, stateOf, highlight, picked, isExpired, extra, idFor }: RateSheetProps) {
  const cols = plans.map(p => (p.key === 'desk' ? '1.3fr' : '1fr')).join(' ')
  const days = period === 'month' ? 30 : 365
  return (
    <div className="rate-sheet" style={{ '--rs-cols': cols } as CSSProperties}>
      {plans.map(plan => {
        const sku = period === 'month' ? plan.month : plan.year
        const state = stateOf(plan)
        const lead = plan.key === 'desk'
        const saving = annualSavingsDollars(plan)
        return (
          <section
            key={plan.key}
            id={idFor?.(plan)}
            className={`rate-sheet__row${lead ? ' rate-sheet__row--lead' : ''}`}
            aria-labelledby={`rs-name-${plan.key}`}
          >
            <div className="rate-sheet__head">
              <h3 id={`rs-name-${plan.key}`} className="rate-sheet__name">{plan.name}</h3>
              {plan.key === picked
                ? <span className="rate-sheet__tag">Your pick</span>
                : lead && <span className="rate-sheet__tag">Includes everything</span>}
            </div>

            <div className="rate-sheet__price">
              <span className="rate-sheet__amount">{sku.price}</span>
              <span className="rate-sheet__term">for {days} days, one payment</span>
            </div>

            {saving > 0 && (period === 'year' ? (
              <p className="rate-sheet__save">{usd(saving)} less than twelve 30-day passes</p>
            ) : (
              <p className="rate-sheet__save rate-sheet__save--quiet">
                Or {plan.year.price} for 365 days, {usd(saving)} less than twelve of these
              </p>
            ))}

            <p className="rate-sheet__desc">{plan.tagline}</p>

            <ul className="rate-sheet__features">
              {plan.features.map(f => <li key={f}>{f}</li>)}
            </ul>

            <div className="rate-sheet__actions">
              {state === 'current' ? (
                <button className="btn btn--outline" style={{ width: '100%', justifyContent: 'center' }} disabled>
                  Current Plan
                </button>
              ) : (
                <CheckoutButton
                  priceId={sku.priceId}
                  tierKey={plan.key}
                  period={sku.period}
                  label={state === 'extend' ? 'Add 365 Days' : isExpired ? `Renew — ${sku.price}` : sku.ctaLabel}
                  variant={plan.key === highlight ? 'primary' : 'outline'}
                />
              )}
              {extra?.(plan)}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Shown in place of the sheet when there is nothing left to sell. */
export function ToppedOut({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="rate-topped">
      <p className="rate-topped__name">{isAdmin ? 'Admin' : 'The Research Desk'}</p>
      <p>
        {isAdmin
          ? 'Admin accounts hold everything. Nothing to buy here.'
          : 'You hold the Research Desk: every game, the whole Vault and every pick.'}
      </p>
      <Link href="/desk/nfl" className="btn btn--outline">Open the Desk</Link>
    </div>
  )
}

export default function PricingCards({
  membership,
  currentTier,
  showFree = false,
  highlight = 'desk',
  trial = null,
}: Props) {
  const isPaid = membership === 'active' || membership === 'admin'
  // Logged-out, free and trial visitors open on 30 days; paying members on 365.
  const [period, setPeriod] = useState<BillingPeriod>(
    isPaid && !trial?.onTrial ? 'year' : 'month'
  )

  const isLoggedIn = membership !== 'logged-out'
  const isExpired = membership === 'expired'
  const isAdmin = membership === 'admin'

  const stateOf = (plan: OfferPlan) => cardState(currentTier, isPaid, plan, period, trial?.onTrial)
  const offered = OFFER_PLANS.filter(plan => stateOf(plan) !== 'hide')
  // A member already holding the top product, or an admin, has nothing to be
  // sold. The anti-downgrade rule would otherwise leave one lonely row.
  const nothingToSell = isAdmin || offered.every(plan => stateOf(plan) === 'current')

  if (nothingToSell) {
    return <div className="rate-wrap"><ToppedOut isAdmin={isAdmin} /></div>
  }

  return (
    <div className="rate-wrap">
      <div className="rate-bar">
        <p className="rate-bar__note">One payment for 30 or 365 days. Nothing renews.</p>
        <PeriodToggle period={period} onChange={setPeriod} />
      </div>

      <RateSheet
        plans={offered}
        period={period}
        stateOf={stateOf}
        highlight={highlight}
        isExpired={isExpired}
        extra={plan => (plan.key === 'desk' && trial && !isPaid
          ? <TrialButton available={trial.available} loggedIn={isLoggedIn} />
          : null)}
      />

      <p className="rate-terms">
        No automatic renewal. No recurring charges. Access expires at the end of the purchased period.
      </p>

      {showFree && (
        <div className="retail-strip">
          <div className="retail-strip__head">
            <span className="retail-strip__name">Free account</span>
            <span className="retail-strip__price">Free</span>
          </div>
          <ul className="retail-strip__features">
            {OFFER_FREE_FEATURES.map(f => (
              <li
                key={f.text}
                className={`retail-strip__feature${f.included ? '' : ' retail-strip__feature--muted'}`}
              >
                <span className={f.included ? 'check' : 'cross'}>
                  {f.included ? '✓' : '✕'}
                </span>{' '}
                {f.text}
              </li>
            ))}
          </ul>
          {!isPaid && (
            !isLoggedIn ? (
              <Link href="/signup" className="btn btn--outline">Create Free Account</Link>
            ) : (
              <button className="btn btn--outline" disabled>Current Plan</button>
            )
          )}
        </div>
      )}
    </div>
  )
}
