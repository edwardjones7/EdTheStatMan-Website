'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import '@/styles/proof-win.css'
import CheckoutButton from './CheckoutButton'
import { cardState, holdsSeason } from './PricingCards'
import { OFFER_PLANS, OFFER_FREE_FEATURES } from '@/lib/offer'
import type { OfferPlan, OfferTierKey, BillingPeriod } from '@/lib/offer'
import type { Membership, Tier } from '@/lib/access'
import { trackEvent } from '@/lib/track-client'

/**
 * The plans on /win, and only there. PricingCards still renders the full
 * ladder on /desk/[sport] and the Vault pages; this is the same ladder at the
 * same prices, shown as three headline cards plus a table that holds all five
 * rungs. Five cards side by side made the buyer do the comparison themselves.
 *
 * Purchase rules (what a member is offered, the season upgrade from monthly)
 * are PricingCards' cardState(), imported, so the two surfaces cannot disagree
 * about what someone may buy.
 */

/** The three rungs that get a card. Institutional lives in the table. */
const HEADLINE_KEYS: OfferTierKey[] = ['portfolio', 'desk', 'private']

/**
 * What each card IS, in two or three words. "Everything" was the first idea
 * for Private and is false: Institutional sits above it.
 */
const HEADLINE_LABEL: Record<OfferTierKey, string> = {
  portfolio: 'Picks',
  desk: 'Picks + Research',
  private: 'Picks + Research + Vault',
  institutional: 'The strongest signals',
}

const COMING = /^Coming this season\s*[—–-]\s*/

type Col = 'retail' | OfferTierKey
const COLS: Col[] = ['retail', ...OFFER_PLANS.map(p => p.key)]

interface Row {
  text: string
  soon: boolean
  has: Record<Col, boolean>
}

/**
 * Comparison rows, derived from lib/offer.ts so the table can never claim more
 * than the cards do. A rung's own bullets are true for it and every rung above
 * ("Everything in ..." bullets are the table's columns, so they are dropped).
 * The free rung's included bullets are true for every column; its excluded
 * ones are the paid rows restated, so they are dropped too.
 */
function buildRows(): Row[] {
  const rows: Row[] = OFFER_FREE_FEATURES.filter(f => f.included).map(f => ({
    text: f.text,
    soon: false,
    has: Object.fromEntries(COLS.map(c => [c, true])) as Record<Col, boolean>,
  }))
  OFFER_PLANS.forEach((plan, i) => {
    for (const f of plan.features) {
      if (/^Everything in /.test(f)) continue
      const has = Object.fromEntries(COLS.map(c => [c, false])) as Record<Col, boolean>
      OFFER_PLANS.slice(i).forEach(p => { has[p.key] = true })
      rows.push({ text: f.replace(COMING, ''), soon: COMING.test(f), has })
    }
  })
  return rows
}

const ROWS = buildRows()

interface Props {
  membership: Membership
  currentTier: Tier | null
  expiresAt: string | null
  /** From ?period= (another surface links here with a period chosen). */
  initialPeriod: BillingPeriod
  /** From ?plan=: highlighted, and scrolled to on arrival. */
  selectedPlan: OfferTierKey | null
}

export default function WinPlans({ membership, currentTier, expiresAt, initialPeriod, selectedPlan }: Props) {
  const [period, setPeriod] = useState<BillingPeriod>(initialPeriod)
  const heldSeason = holdsSeason(expiresAt)

  const isPaid = membership === 'active' || membership === 'admin'
  const isAdmin = membership === 'admin'
  const isLoggedIn = membership !== 'logged-out'
  const isExpired = membership === 'expired'

  const state = (plan: OfferPlan) => cardState(currentTier, isPaid, plan, period, heldSeason)
  const offered = OFFER_PLANS.filter(p => state(p) !== 'hide')
  const nothingToSell = isAdmin || offered.every(p => state(p) === 'current')

  // Cards: the three headline rungs this visitor can still buy, plus the plan
  // a link asked for if it is not one of them. A member above the headline
  // rungs falls back to whatever is left so the row is never empty.
  let cards = offered.filter(p => HEADLINE_KEYS.includes(p.key) || p.key === selectedPlan)
  if (cards.length === 0) cards = offered
  const featuredKey: OfferTierKey = selectedPlan && cards.some(c => c.key === selectedPlan)
    ? selectedPlan
    : 'desk'

  const cols = cards.length
  const colsMd = cols <= 2 ? cols : cols % 2 === 0 ? 2 : 1

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
    const sku = period === 'month' ? plan.month : plan.season
    const s = state(plan)
    if (s === 'current') {
      return (
        <button className={`btn btn--outline${small ? ' btn--sm' : ''}`} style={{ width: '100%', justifyContent: 'center' }} disabled>
          Current Plan
        </button>
      )
    }
    if (s === 'hide') return <span className="win-compare__incl">Included</span>
    return (
      <CheckoutButton
        priceId={sku.priceId}
        tierKey={plan.key}
        period={sku.period}
        label={isExpired ? `Renew — ${sku.price}` : sku.ctaLabel}
        variant={featured ? 'primary' : 'outline'}
        className={small ? 'btn--sm' : undefined}
      />
    )
  }

  return (
    <div className="win-plans">
      <div className="billing-toggle" role="group" aria-label="Billing period">
        <button
          type="button"
          className={`billing-toggle__opt${period === 'month' ? ' is-active' : ''}`}
          onClick={() => choose('month')}
          aria-pressed={period === 'month'}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`billing-toggle__opt${period === 'season' ? ' is-active' : ''}`}
          onClick={() => choose('season')}
          aria-pressed={period === 'season'}
        >
          Season Pass
          <span className="billing-toggle__hint">best value</span>
        </button>
      </div>

      {nothingToSell ? (
        <div className="pricing-topped-out">
          <span className="pricing-topped-out__badge">{isAdmin ? 'Admin' : 'Institutional Intelligence'}</span>
          <p>
            {isAdmin
              ? 'Admin accounts hold every rung of the ladder. Nothing to buy here.'
              : 'You hold the top rung. Every system, every trend, the highest-conviction library, and the whole schedule.'}
          </p>
          <Link href="/vault" className="btn btn--outline">Open the Vault</Link>
        </div>
      ) : (
        <div
          className="pricing-grid win-plans__grid"
          style={{ '--pricing-cols': cols, '--pricing-cols-md': colsMd } as CSSProperties}
        >
          {cards.map(plan => {
            const sku = period === 'month' ? plan.month : plan.season
            const featured = plan.key === featuredKey
            return (
              <div
                key={plan.key}
                id={`plan-${plan.key}`}
                // The global ::before on --featured says "Most Popular"; this
                // page says why it is marked instead, via data-flag.
                data-flag={plan.key === selectedPlan ? 'Your pick' : 'Recommended'}
                className={[
                  'pricing-card win-card',
                  featured ? 'pricing-card--featured' : '',
                  plan.key === 'private' || plan.key === 'institutional' ? 'pricing-card--vault' : '',
                ].filter(Boolean).join(' ')}
              >
                <span className="win-card__label">{HEADLINE_LABEL[plan.key]}</span>
                <div className="pricing-card__name">{plan.name}</div>
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
                {cta(plan, featured)}
                <div className="pricing-card__note">{sku.note}</div>
              </div>
            )
          })}
        </div>
      )}

      <section className="win-compare" aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="win-compare__title">Compare all plans</h2>
        <p className="win-compare__sub">
          Every rung includes everything below it.{' '}
          {period === 'season' ? 'Season prices shown, one-time.' : 'Monthly prices shown.'}
        </p>
        {/* Scrolls inside its own box at phone width; the page itself never
            scrolls sideways. The feature column stays pinned. */}
        <div className="win-compare__scroll" tabIndex={0} aria-label="Plan comparison table, scrolls sideways">
          <table className="win-compare__table">
            <thead>
              <tr>
                <th scope="col" className="win-compare__feat">Feature</th>
                <th scope="col" id="compare-retail">
                  <span className="win-compare__name">Public</span>
                  <span className="win-compare__price">Free</span>
                </th>
                {OFFER_PLANS.map(plan => {
                  const sku = period === 'month' ? plan.month : plan.season
                  return (
                    <th
                      key={plan.key}
                      scope="col"
                      id={`compare-${plan.key}`}
                      className={plan.key === featuredKey ? 'is-featured' : undefined}
                    >
                      <span className="win-compare__name">{plan.shortName}</span>
                      <span className="win-compare__price">
                        {sku.price}{sku.mode === 'subscription' ? '/mo' : ''}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(row => (
                <tr key={row.text}>
                  <th scope="row" className="win-compare__feat">
                    {row.text}
                    {row.soon && <span className="win-compare__soon">Coming this season</span>}
                  </th>
                  {COLS.map(c => (
                    <td key={c} className={c === featuredKey ? 'is-featured' : undefined}>
                      {row.has[c]
                        ? <span className="check" aria-label={row.soon ? 'Coming this season' : 'Included'}>{row.soon ? '…' : '✓'}</span>
                        : <span className="win-compare__no" aria-label="Not included">&ndash;</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="win-compare__feat">
                  {period === 'season' ? 'Season pass' : 'Monthly'}
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
