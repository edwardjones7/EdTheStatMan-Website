'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import '@/styles/proof-win.css'
import CheckoutButton from './CheckoutButton'
import TrialButton from './TrialButton'
import { OFFER_PLANS, OFFER_FREE_FEATURES, annualSavingsPct } from '@/lib/offer'
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
  /** Show the free-trial button on the Research Desk card (lib/trial.ts). */
  trial?: { available: boolean; onTrial: boolean } | null
}

/**
 * What to show on a plan card for this member. Shared with WinPlans, and the
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

  const offered = OFFER_PLANS.filter(
    plan => cardState(currentTier, isPaid, plan, period, trial?.onTrial) !== 'hide'
  )
  // A member already at the top rung, or an admin, has nothing to be sold. The
  // anti-downgrade rule would otherwise leave one card stretched across the
  // full grid width, which reads like a broken layout rather than a good place
  // to be.
  const nothingToSell = isAdmin || offered.every(
    plan => cardState(currentTier, isPaid, plan, period, trial?.onTrial) === 'current'
  )

  // The grid used to be auto-fit/minmax, which fit only three 300px columns
  // inside the 1232px container and dropped the fourth card onto a row of its
  // own. Drive the column count off the number of cards actually rendered so a
  // full ladder is one row of four and a trimmed ladder never leaves an orphan:
  // the mid breakpoint halves an even count and stacks an odd one.
  const cols = offered.length
  const colsMd = cols <= 2 ? cols : cols % 2 === 0 ? 2 : 1

  if (nothingToSell) {
    return (
      <div className="pricing-topped-out">
        <span className="pricing-topped-out__badge">
          {isAdmin ? 'Admin' : 'The Research Desk'}
        </span>
        <p>
          {isAdmin
            ? 'Admin accounts hold everything. Nothing to buy here.'
            : 'You hold the Research Desk: every game, the whole Vault and every pick.'}
        </p>
        <Link href="/desk/nfl" className="btn btn--outline">Open the Desk</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1320px', margin: '0 auto' }}>
      <div className="billing-toggle" role="group" aria-label="Billing period">
        <button
          type="button"
          className={`billing-toggle__opt${period === 'month' ? ' is-active' : ''}`}
          onClick={() => setPeriod('month')}
          aria-pressed={period === 'month'}
        >
          30-Day Access
        </button>
        <button
          type="button"
          className={`billing-toggle__opt${period === 'year' ? ' is-active' : ''}`}
          onClick={() => setPeriod('year')}
          aria-pressed={period === 'year'}
        >
          365-Day Access
          <span className="billing-toggle__hint">best value</span>
        </button>
      </div>

      <div
        className={`pricing-grid stagger-children${cols >= 4 ? ' pricing-grid--compact' : ''}`}
        style={{ '--pricing-cols': cols, '--pricing-cols-md': colsMd } as CSSProperties}
      >
        {offered.map(plan => {
          const sku = period === 'month' ? plan.month : plan.year
          const state = cardState(currentTier, isPaid, plan, period, trial?.onTrial)

          const featured = plan.key === highlight
          const vault = plan.key === 'private'
          const top = plan.key === 'desk'

          return (
            <div
              key={plan.key}
              className={[
                'pricing-card reveal-scale',
                featured ? 'pricing-card--featured' : '',
                vault ? 'pricing-card--vault' : '',
                top ? 'pricing-card--institutional' : '',
              ].filter(Boolean).join(' ')}
            >
              <div className="pricing-card__name">
                {plan.name}
                {plan.badge && <span className="pricing-card__badge">{plan.badge}</span>}
              </div>

              <div className="pricing-card__price">{sku.price}</div>
              <div className="pricing-card__term">{sku.note}</div>
              {period === 'year' && (
                <div className="pricing-card__save">Save {annualSavingsPct(plan)}% versus 30-day pricing</div>
              )}

              <div className="pricing-card__desc">{plan.tagline}</div>

              <ul className="pricing-card__features">
                {plan.features.map(f => (
                  <li key={f} className="pricing-card__feature">
                    <span className="check">{'✓'}</span> {f}
                  </li>
                ))}
              </ul>

              {state === 'current' ? (
                <button
                  className={`btn btn--${featured ? 'primary' : 'outline'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                  disabled
                >
                  Current Plan
                </button>
              ) : (
                <CheckoutButton
                  priceId={sku.priceId}
                  tierKey={plan.key}
                  period={sku.period}
                  label={state === 'extend' ? 'Add 365 Days' : isExpired ? `Renew — ${sku.price}` : sku.ctaLabel}
                  variant={featured ? 'primary' : 'outline'}
                />
              )}
              {plan.key === 'desk' && trial && !isPaid && (
                <TrialButton available={trial.available} loggedIn={isLoggedIn} />
              )}
            </div>
          )
        })}
      </div>

      <p className="pricing-terms">
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
