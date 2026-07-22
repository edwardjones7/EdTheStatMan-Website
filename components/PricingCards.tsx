import Link from 'next/link'
import CheckoutButton from './CheckoutButton'
import { OFFER_PLANS, OFFER_FREE_FEATURES } from '@/lib/offer'
import type { OfferTierKey } from '@/lib/offer'
import type { Membership, SubscriptionTier } from '@/lib/access'

/** Only 'basic' → 'premium' is an upsell worth showing an active member. */
function isUpgrade(current: SubscriptionTier | null, plan: OfferTierKey): boolean {
  return current === 'basic' && plan === 'premium'
}

interface Props {
  membership: Membership
  currentTier: SubscriptionTier | null
  /** Include the Free comparison column (pricing page only). */
  showFree?: boolean
  highlight?: OfferTierKey
}

export default function PricingCards({
  membership,
  currentTier,
  showFree = false,
  highlight = 'premium',
}: Props) {
  const isPaid = membership === 'active' || membership === 'admin'
  const isLoggedIn = membership !== 'logged-out'

  return (
    <div
      className="pricing-grid stagger-children"
      style={{ maxWidth: showFree ? '1040px' : '680px', margin: '0 auto' }}
    >
      {showFree && (
        <div className="pricing-card reveal-scale">
          <div className="pricing-card__name">Free</div>
          <div className="pricing-card__price">$0</div>
          <div className="pricing-card__desc">A taste of what&apos;s available</div>
          <ul className="pricing-card__features">
            {OFFER_FREE_FEATURES.map(f => (
              <li
                key={f.text}
                className={`pricing-card__feature${f.included ? '' : ' pricing-card__feature--muted'}`}
              >
                <span className={f.included ? 'check' : 'cross'}>{f.included ? '✓' : '✗'}</span>{' '}
                {f.text}
              </li>
            ))}
          </ul>
          {!isPaid && (
            <>
              {!isLoggedIn ? (
                <Link href="/signup" className="btn btn--outline" style={{ width: '100%', justifyContent: 'center' }}>
                  Create Free Account
                </Link>
              ) : (
                <button className="btn btn--outline" style={{ width: '100%', justifyContent: 'center' }} disabled>
                  Current Plan
                </button>
              )}
              {/* Mirrors the paid cards' note. Without something in this slot the
                  Free button drops to the card's bottom edge and sits lower than
                  the others, since .pricing-card__features flexes to fill. */}
              <div className="pricing-card__note">No card required</div>
            </>
          )}
        </div>
      )}

      {OFFER_PLANS.map(plan => {
        const isCurrent = isPaid && currentTier === plan.key
        const featured = plan.key === highlight

        return (
          <div
            key={plan.key}
            className={`pricing-card reveal-scale${featured ? ' pricing-card--featured' : ''}`}
          >
            <div className="pricing-card__name">
              {plan.name}
              {plan.badge && <span className="pricing-card__badge">{plan.badge}</span>}
            </div>
            <div className="pricing-card__price">{plan.price}</div>
            <div className="pricing-card__desc">
              {plan.duration}
              {plan.equivalent && <> &middot; {plan.equivalent}</>}
            </div>
            <ul className="pricing-card__features">
              {plan.features.map(f => (
                <li key={f} className="pricing-card__feature">
                  <span className="check">{'✓'}</span> {f}
                </li>
              ))}
            </ul>

            {isCurrent ? (
              <button
                className={`btn btn--${featured ? 'primary' : 'outline'}`}
                style={{ width: '100%', justifyContent: 'center' }}
                disabled
              >
                Current Plan
              </button>
            ) : isPaid && !isUpgrade(currentTier, plan.key) ? (
              // Don't offer an active member a shorter pass than the one they hold.
              null
            ) : (
              <CheckoutButton
                priceId={plan.priceId}
                tierKey={plan.key}
                label={membership === 'expired' ? `Renew — ${plan.price}` : plan.ctaLabel}
                variant={featured ? 'primary' : 'outline'}
              />
            )}

            <div className="pricing-card__note">{plan.note}</div>
          </div>
        )
      })}
    </div>
  )
}
