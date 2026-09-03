'use client'

import { useState, type CSSProperties } from 'react'
import Link from 'next/link'
import CheckoutButton from './CheckoutButton'
import { OFFER_PLANS, OFFER_FREE_FEATURES } from '@/lib/offer'
import type { OfferPlan, OfferTierKey, BillingPeriod } from '@/lib/offer'
import { TIER_RANK, normalizeTier, type Membership, type Tier } from '@/lib/access'

interface Props {
  membership: Membership
  currentTier: Tier | null
  /** Include the Retail comparison column (offer page only). */
  showFree?: boolean
  highlight?: OfferTierKey
}

/**
 * What to show on a plan card for this member.
 *
 *   'current'  they hold exactly this rung on this billing period
 *   'buy'      offer it
 *   'hide'     strictly below what they already hold
 *
 * Note the deliberate difference from the old isUpgrade(): a member on the
 * MONTHLY plan of a rung is still offered that rung's SEASON pass. The previous
 * implementation returned false for equal rank and rendered no button at all,
 * which silently blocked the most valuable conversion on the page.
 */
function cardState(
  currentTier: Tier | null,
  isPaid: boolean,
  plan: OfferPlan,
  period: BillingPeriod,
  billingMode: 'monthly' | 'season' | null
): 'current' | 'buy' | 'hide' {
  if (!isPaid || !currentTier) return 'buy'
  const held = TIER_RANK[normalizeTier(currentTier)]
  const offered = TIER_RANK[plan.key]
  if (offered > held) return 'buy'
  if (offered < held) return 'hide'
  // Same rung: the season pass is still an upgrade from monthly.
  if (period === 'season' && billingMode !== 'season') return 'buy'
  return 'current'
}

export default function PricingCards({
  membership,
  currentTier,
  showFree = false,
  highlight = 'desk',
}: Props) {
  const [period, setPeriod] = useState<BillingPeriod>('season')

  const isPaid = membership === 'active' || membership === 'admin'
  const isLoggedIn = membership !== 'logged-out'
  const isExpired = membership === 'expired'
  const isAdmin = membership === 'admin'

  const offered = OFFER_PLANS.filter(
    plan => cardState(currentTier, isPaid, plan, period, null) !== 'hide'
  )
  // A member already at the top rung, or an admin, has nothing to be sold. The
  // anti-downgrade rule would otherwise leave one card stretched across the
  // full grid width, which reads like a broken layout rather than a good place
  // to be.
  const nothingToSell = isAdmin || offered.every(
    plan => cardState(currentTier, isPaid, plan, period, null) === 'current'
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
          {isAdmin ? 'Admin' : 'Institutional Intelligence'}
        </span>
        <p>
          {isAdmin
            ? 'Admin accounts hold every rung of the ladder. Nothing to buy here.'
            : 'You hold the top rung. Every system, every trend, the raw rows underneath them, and the whole schedule.'}
        </p>
        <Link href="/vault" className="btn btn--outline">Open the Vault</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1320px', margin: '0 auto' }}>
      {/* The season pass is the SKU we push: one sale and one dispute window
          instead of twelve of each. It is the default selection. */}
      <div className="billing-toggle" role="group" aria-label="Billing period">
        <button
          type="button"
          className={`billing-toggle__opt${period === 'month' ? ' is-active' : ''}`}
          onClick={() => setPeriod('month')}
          aria-pressed={period === 'month'}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`billing-toggle__opt${period === 'season' ? ' is-active' : ''}`}
          onClick={() => setPeriod('season')}
          aria-pressed={period === 'season'}
        >
          Season Pass
          <span className="billing-toggle__hint">best value</span>
        </button>
      </div>

      <div
        className={`pricing-grid stagger-children${cols >= 4 ? ' pricing-grid--compact' : ''}`}
        style={{ '--pricing-cols': cols, '--pricing-cols-md': colsMd } as CSSProperties}
      >
        {offered.map(plan => {
          const sku = period === 'month' ? plan.month : plan.season
          const state = cardState(currentTier, isPaid, plan, period, null)

          const featured = plan.key === highlight
          const vault = plan.key === 'private' || plan.key === 'institutional'
          const top = plan.key === 'institutional'

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

              <div className="pricing-card__price">
                {sku.price}
                {sku.mode === 'subscription' && <span className="pricing-card__per">/mo</span>}
              </div>

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
                  label={isExpired ? `Renew — ${sku.price}` : sku.ctaLabel}
                  variant={featured ? 'primary' : 'outline'}
                />
              )}

              <div className="pricing-card__note">{sku.note}</div>
            </div>
          )
        })}
      </div>

      {showFree && (
        <div className="retail-strip">
          <div className="retail-strip__head">
            <span className="retail-strip__name">Vault {'—'} Retail Intelligence</span>
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
