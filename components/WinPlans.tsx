'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import '@/styles/proof-win.css'
import '@/styles/rate-sheet.css'
import CheckoutButton from './CheckoutButton'
import TrialButton from './TrialButton'
import { cardState, RateSheet, PeriodToggle, ToppedOut } from './PricingCards'
import {
  OFFER_PLANS, OFFER_FREE_FEATURES, OFFER_COMPARE_ROWS, TRIAL_DAYS,
} from '@/lib/offer'
import type { OfferPlan, OfferTierKey, BillingPeriod } from '@/lib/offer'
import type { Membership, Tier } from '@/lib/access'
import { trackEvent } from '@/lib/track-client'

/**
 * The plans on /win. Three products in the order Ed sells them -- Research
 * Desk, Vault, Portfolio -- on a 30-day / 365-day toggle, every one a one-time
 * payment, as one rate sheet (RateSheet). PricingCards renders the same sheet
 * on the Desk and Vault paywalls;
 * the purchase rules are its cardState(), imported, so the two surfaces cannot
 * disagree about what someone may buy.
 *
 * The comparison table is explicit per product (OFFER_COMPARE_ROWS) rather
 * than derived "each rung includes the one below": the Vault does not include
 * the picks, so the products are not a ladder.
 */

type Col = 'retail' | OfferTierKey

interface Row {
  text: string
  has: Record<Col, boolean>
}

function buildRows(): Row[] {
  const cols: Col[] = ['retail', ...OFFER_PLANS.map(p => p.key)]
  const free: Row[] = OFFER_FREE_FEATURES.filter(f => f.included).map(f => ({
    text: f.text,
    has: Object.fromEntries(cols.map(c => [c, true])) as Record<Col, boolean>,
  }))
  const paid: Row[] = OFFER_COMPARE_ROWS.map(r => ({
    text: r.text,
    has: Object.fromEntries(cols.map(c => [c, c !== 'retail' && r.has.includes(c)])) as Record<Col, boolean>,
  }))
  return [...paid, ...free]
}

const ROWS = buildRows()
const COLS: Col[] = ['retail', ...OFFER_PLANS.map(p => p.key)]

interface Props {
  membership: Membership
  currentTier: Tier | null
  /** From ?period= (another surface links here with a period chosen). */
  initialPeriod: BillingPeriod
  /** From ?plan=: highlighted, and scrolled to on arrival. */
  selectedPlan: OfferTierKey | null
  /** Logged in, never trialled, and holding nothing paid. */
  trialAvailable: boolean
  /** Their Desk access right now IS the free trial. */
  onTrial: boolean
}

export default function WinPlans({ membership, currentTier, initialPeriod, selectedPlan, trialAvailable, onTrial }: Props) {
  const [period, setPeriod] = useState<BillingPeriod>(initialPeriod)

  const isPaid = membership === 'active' || membership === 'admin'
  const isAdmin = membership === 'admin'
  const isLoggedIn = membership !== 'logged-out'
  const isExpired = membership === 'expired'

  const state = (plan: OfferPlan) => cardState(currentTier, isPaid, plan, period, onTrial)
  const cards = OFFER_PLANS.filter(p => state(p) !== 'hide')
  const nothingToSell = isAdmin || cards.every(p => state(p) === 'current')
  const featuredKey: OfferTierKey = selectedPlan && cards.some(c => c.key === selectedPlan)
    ? selectedPlan
    : 'desk'

  useEffect(() => {
    if (!selectedPlan) return
    const el = document.getElementById(`plan-${selectedPlan}`) ?? document.getElementById(`compare-${selectedPlan}`)
    // After layout, so the reveal animations do not shift the target.
    const t = window.setTimeout(() => el?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
    return () => window.clearTimeout(t)
  }, [selectedPlan])

  function choose(next: BillingPeriod) {
    if (next === period) return
    setPeriod(next)
    trackEvent('plan_toggle', { period: next, from: period })
  }

  function cta(plan: OfferPlan, featured: boolean, small = false) {
    const sku = period === 'month' ? plan.month : plan.year
    const s = state(plan)
    if (s === 'current') {
      return (
        <button className={`btn btn--outline${small ? ' btn--sm' : ''}`} style={{ width: '100%', justifyContent: 'center' }} disabled>
          Current Plan
        </button>
      )
    }
    if (s === 'hide') return <span className="win-compare__incl">{plan.key === 'desk' ? 'Yours' : '—'}</span>
    return (
      <CheckoutButton
        priceId={sku.priceId}
        tierKey={plan.key}
        period={sku.period}
        label={s === 'extend' ? 'Add 365 Days' : isExpired ? `Renew — ${sku.price}` : sku.ctaLabel}
        variant={featured ? 'primary' : 'outline'}
        className={small ? 'btn--sm' : undefined}
      />
    )
  }

  return (
    <div className="win-plans rate-wrap">
      <div className="rate-bar">
        <p className="rate-bar__note">
          {period === 'year' ? 'Prices for 365 days.' : 'Prices for 30 days.'} One payment, nothing renews.
        </p>
        <PeriodToggle period={period} onChange={choose} />
      </div>

      {nothingToSell ? (
        <ToppedOut isAdmin={isAdmin} />
      ) : (
        <RateSheet
          plans={cards}
          period={period}
          stateOf={state}
          highlight={featuredKey}
          picked={selectedPlan}
          isExpired={isExpired}
          idFor={plan => `plan-${plan.key}`}
          extra={plan => plan.key === 'desk' ? (
            <>
              {!isPaid && <TrialButton available={trialAvailable} loggedIn={isLoggedIn} />}
              {onTrial && (
                <p className="rate-sheet__note">You are on the free trial. Buying ends it and starts your paid days.</p>
              )}
            </>
          ) : null}
        />
      )}

      <p className="rate-terms">
        No automatic renewal. No recurring charges. Access expires at the end of the purchased period.
        {' '}The {TRIAL_DAYS}-day Research Desk trial needs no card and ends on its own.
      </p>

      <section className="win-compare" aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="win-compare__title">Compare the plans</h2>
        <p className="win-compare__sub">
          The Research Desk holds everything. The Vault and the Portfolio are separate.{' '}
          {period === 'year' ? '365-day prices shown.' : '30-day prices shown.'}
        </p>
        {/* Scrolls inside its own box at phone width; the page itself never
            scrolls sideways. The feature column stays pinned. */}
        <div className="win-compare__scroll" tabIndex={0} aria-label="Plan comparison table, scrolls sideways">
          <table className="win-compare__table">
            <thead>
              <tr>
                <th scope="col" className="win-compare__feat">Feature</th>
                <th scope="col" id="compare-retail">
                  <span className="win-compare__name">Free</span>
                  <span className="win-compare__price">$0</span>
                </th>
                {OFFER_PLANS.map(plan => {
                  const sku = period === 'month' ? plan.month : plan.year
                  return (
                    <th
                      key={plan.key}
                      scope="col"
                      id={`compare-${plan.key}`}
                      className={plan.key === featuredKey ? 'is-featured' : undefined}
                    >
                      <span className="win-compare__name">{plan.shortName}</span>
                      <span className="win-compare__price">{sku.price}</span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(row => (
                <tr key={row.text}>
                  <th scope="row" className="win-compare__feat">{row.text}</th>
                  {COLS.map(c => (
                    <td key={c} className={c === featuredKey ? 'is-featured' : undefined}>
                      {row.has[c]
                        ? <span className="check" aria-label="Included">{'✓'}</span>
                        : <span className="win-compare__no" aria-label="Not included">&ndash;</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="win-compare__feat">
                  {period === 'year' ? '365 days' : '30 days'}
                </th>
                <td>
                  {isPaid
                    ? <span className="win-compare__incl">Included</span>
                    : isLoggedIn
                      ? <span className="win-compare__incl">Your plan</span>
                      : <Link href="/signup" className="btn btn--outline btn--sm" style={{ width: '100%', justifyContent: 'center' }}>Join Free</Link>}
                </td>
                {OFFER_PLANS.map(plan => (
                  <td key={plan.key} className={plan.key === featuredKey ? 'is-featured' : undefined}>
                    {isAdmin ? <span className="win-compare__incl">Included</span> : cta(plan, plan.key === featuredKey, true)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  )
}
