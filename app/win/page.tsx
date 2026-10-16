import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import WinPlans from '@/components/WinPlans'
import CheckoutAutoStart from '@/components/CheckoutAutoStart'
import ProofStrip from '@/components/ProofStrip'
import { IconArrowRight } from '@/components/Icons'
import {
  OFFER_DISCLAIMER, OFFER_META_DESCRIPTION, OFFER_PLANS, SEASON_ENDS_AT, planByKey,
  type BillingPeriod, type OfferTierKey,
} from '@/lib/offer'
import { resolveAccess, ACCESS_SELECT, TIER_SHORT_LABEL } from '@/lib/access'
import { loadProof } from '@/lib/proof'
import '@/styles/proof-win.css'

// Title and description are the ladder's, not the pre-v3 offer's. Both used to
// name Basic, Premium and the Elite Season Pass at prices that no longer exist,
// which is what search results and every shared link showed. The description is
// derived from OFFER_PLANS so it cannot drift again.
export const metadata: Metadata = {
  title: 'Membership',
  description: OFFER_META_DESCRIPTION,
  alternates: { canonical: 'https://edthestatman.com/win' },
  openGraph: {
    title: 'Membership – EdTheStatMan.com',
    description: OFFER_META_DESCRIPTION,
    url: 'https://edthestatman.com/win',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Membership – EdTheStatMan.com',
    description: OFFER_META_DESCRIPTION,
    images: ['/og-cover.jpg'],
  },
}

/** "February 15, 2027": the season pass end date, as the FAQ states it. */
const SEASON_END_LABEL = new Date(SEASON_ENDS_AT).toLocaleDateString('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
})

/**
 * Every answer here must be true today, by the same rule as the bullets in
 * lib/offer.ts. Delivery channels are lib/notify (email, web push, Discord);
 * cancellation is the billing portal on /account; the no-refund line matches
 * the Stripe checkout page and /terms.
 */
const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: 'What is the difference between the plans?',
    a: (
      <>
        The Portfolio is the picks: every model play with its full line and number, plus the
        graded history. The Research Desk adds the season schedule with opening and current
        lines and a page for every game. Private Intelligence adds the full Vault of systems and
        team trends. Institutional adds the highest-conviction library, which no other rung
        sees. Each rung includes everything below it.
      </>
    ),
  },
  {
    q: 'Do season passes renew?',
    a: (
      <>
        No. A season pass is one payment and runs through {SEASON_END_LABEL}, after the Super
        Bowl. Nothing auto-renews, so there is nothing to cancel. The Portfolio&apos;s 30-day
        option is also one-time and never renews.
      </>
    ),
  },
  {
    q: 'How do I cancel a monthly plan?',
    a: (
      <>
        Monthly Research Desk, Private and Institutional plans bill every month until you cancel.
        Cancel at any time from the billing portal on your{' '}
        <Link href="/account">account page</Link>. Access runs to the end of the period you have
        paid for.
      </>
    ),
  },
  {
    q: 'Can I get a refund?',
    a: (
      <>
        No. All sales are final, including season passes, monthly renewals and unused time.
        Cancelling a monthly plan stops future charges; it does not refund the current one. The
        full policy is in the <Link href="/terms">Terms of Service</Link>.
      </>
    ),
  },
  {
    q: 'How are picks delivered?',
    a: (
      <>
        Every pick goes up on <Link href="/portfolio">The Portfolio</Link> page. When one posts,
        an alert goes out by email, by browser push if you turn it on, and in Discord.
      </>
    ),
  },
  {
    q: 'Is the record verified? Where is every pick?',
    a: (
      <>
        No third party audits it. Every graded pick that counts toward the record is listed on
        the <Link href="/portfolio/performance">results page</Link> with its date, line and
        result, wins and losses alike, so you can check every number yourself. Free picks and
        the members&apos; card are kept as two separate records.
      </>
    ),
  },
]

export default async function Pricing({
  searchParams,
}: {
  searchParams: { checkout?: string; period?: string; canceled?: string; plan?: string }
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let access = resolveAccess(null, false)
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select(ACCESS_SELECT)
      .eq('id', user.id)
      .single()
    access = resolveAccess(profile as any, true)
  }
  const { tier: userTier, isPaid, membership, expiresAt } = access
  const proof = await loadProof()

  const resumePlan = user && !isPaid ? planByKey(searchParams.checkout ?? '') : undefined
  // Resume on the period they picked. This always used the season SKU, so a
  // visitor who chose $49 monthly and signed up landed on a $199-$1,499 checkout.
  const resumeSku = resumePlan
    ? (searchParams.period === 'month' ? resumePlan.month : resumePlan.season)
    : undefined

  // ?plan=<tier>&period=month|season, from links elsewhere on the site. Only
  // preselects and highlights; it never starts a checkout (that is ?checkout=).
  // Season stays the default: it is the SKU we push.
  const initialPeriod: BillingPeriod = searchParams.period === 'month' ? 'month' : 'season'
  const selectedPlan: OfferTierKey | null = OFFER_PLANS.find(p => p.key === searchParams.plan)?.key ?? null

  const entry = OFFER_PLANS[0]

  return (
    <main>
      {resumePlan && resumeSku && <CheckoutAutoStart priceId={resumeSku.priceId} planName={resumePlan.name} />}

      {/* "Simple, Transparent Pricing" was the old header. Five rungs on two
          billing periods is not simple, and the transparency is the record
          right under it, so the header just says what is for sale. */}
      <header className="page-header win-header">
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">Membership</span>
            <h1 className="page-header__title">The picks, the research, <span className="text-gradient">the Vault</span></h1>
            <p className="page-header__subtitle">
              Start with the picks. Add the Research Desk or the full Vault when you want them;
              every rung includes everything below it. Season passes are one payment and never
              renew.
            </p>
          </div>
        </div>
      </header>

      <section className="win-proof" aria-label="The record">
        <div className="container">
          <ProofStrip proof={proof} />
        </div>
      </section>

      <section className="section win-section" id="plans">
        <div className="container">

          {searchParams.canceled === '1' && (
            <div className="win-notice">
              Checkout cancelled — no charge was made. Your card wasn&apos;t billed.
            </div>
          )}

          {membership === 'expired' && (
            <div className="win-notice win-notice--strong">
              Your access has expired. Pick a pass below to pick up where you left off.
            </div>
          )}

          {isPaid && (
            <div className="win-notice win-notice--active">
              ✓ {TIER_SHORT_LABEL[userTier ?? 'retail']} access active
              {expiresAt ? ` until ${expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}.{' '}
              <Link href="/account">View account →</Link>
            </div>
          )}

          <WinPlans
            membership={membership}
            currentTier={userTier}
            expiresAt={expiresAt ? expiresAt.toISOString() : null}
            initialPeriod={initialPeriod}
            selectedPlan={selectedPlan}
          />

          <div className="win-disclaimer">
            <p>
              {OFFER_DISCLAIMER}{' '}
              <strong>All sales are final; we do not offer refunds.</strong>{' '}
              See the <Link href="/terms">Terms of Service</Link>.{' '}
              Questions? <Link href="/contact">Contact us</Link>.
            </p>
          </div>

        </div>
      </section>

      <section className="section win-faq" aria-labelledby="faq-heading">
        <div className="container">
          <h2 id="faq-heading" className="win-faq__title">Questions</h2>
          <div className="win-faq__list">
            {FAQ.map(item => (
              <details key={item.q} className="win-faq__item">
                <summary>{item.q}</summary>
                <div className="win-faq__a">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* The shared CTASection falls back to X / Instagram / Discord for anyone
          it does not think is buying, which ended the offer page by sending
          people off the site. This page ends on the plans. */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-box">
            <h2 className="cta-box__title">
              Start with <span className="text-gradient">the picks</span>
            </h2>
            <p className="cta-box__text">
              {isPaid
                ? 'Your plan is active. Any rung above it is in the plans, whenever you want it.'
                : `The Portfolio is ${entry.month.price} for 30 days or ${entry.season.price} for the season, and every graded pick is public before you buy.`}
            </p>
            <div className="cta-box__actions">
              <a href="#plans" className="btn btn--primary btn--lg">
                Choose a Plan <IconArrowRight size={16} />
              </a>
              {isPaid ? (
                <Link href="/account" className="btn btn--secondary btn--lg">Your Account</Link>
              ) : (
                <Link href="/picks" className="btn btn--secondary btn--lg">Get Free Picks</Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
