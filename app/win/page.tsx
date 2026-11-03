import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import WinPlans from '@/components/WinPlans'
import CheckoutAutoStart from '@/components/CheckoutAutoStart'
import ProofStrip from '@/components/ProofStrip'
import { IconArrowRight } from '@/components/Icons'
import {
  OFFER_META_DESCRIPTION, OFFER_PLANS, TRIAL_DAYS, planByKey,
  type BillingPeriod, type OfferTierKey,
} from '@/lib/offer'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadTrialState } from '@/lib/trial'
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
        The Research Desk is everything: every game in the NFL, college football, NBA and college
        basketball on its own page with the systems, trends and bets attached, plus the complete
        Handicapping Vault and every EdTheStatBot Portfolio pick. The Handicapping Vault is the
        full library of systems and team trends. The EdTheStatBot Portfolio is the picks, with
        the full line and number and the graded history. The Vault and the Portfolio are
        separate; the Research Desk is the only plan with both.
      </>
    ),
  },
  {
    q: 'How does the free trial work?',
    a: (
      <>
        Create a free account and start the trial from the Research Desk card. You get the whole
        Research Desk for {TRIAL_DAYS} days. We never ask for a card, so there is nothing to
        cancel and nothing is charged when it ends. After that, buy whichever plan fits, or none.
        One trial per account.
      </>
    ),
  },
  {
    q: 'Does anything renew?',
    a: (
      <>
        No. Every plan is one payment for 30 or 365 days. There is no automatic renewal and no
        recurring charge, so there is nothing to cancel. Access ends at the end of the period you
        bought, and you can buy again whenever you like.
      </>
    ),
  },
  {
    q: 'Can I get a refund?',
    a: (
      <>
        No. All sales are final, including unused time. The full policy is in the{' '}
        <Link href="/terms">Terms of Service</Link>.
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
  searchParams: { checkout?: string; period?: string; canceled?: string; plan?: string; trial?: string }
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
  const [proof, trial] = await Promise.all([
    loadProof(),
    loadTrialState(createAdminClient(), user?.id),
  ])

  const resumePlan = user && (!isPaid || trial.onTrial) ? planByKey(searchParams.checkout ?? '') : undefined
  // Resume on the period they picked, so a 30-day buyer who had to sign up
  // first does not land on a 365-day checkout.
  const resumeSku = resumePlan
    ? (searchParams.period === 'month' ? resumePlan.month : resumePlan.year)
    : undefined

  // ?plan=<tier>&period=month|year, from links elsewhere on the site. Only
  // preselects and highlights; it never starts a checkout (that is ?checkout=).
  // 365 days stays the default: it is the SKU we push. ?trial=1 (back from
  // signup via the trial button) highlights the Research Desk.
  const initialPeriod: BillingPeriod = searchParams.period === 'month' ? 'month' : 'year'
  const selectedPlan: OfferTierKey | null =
    OFFER_PLANS.find(p => p.key === searchParams.plan)?.key ?? (searchParams.trial ? 'desk' : null)

  const entry = OFFER_PLANS.find(p => p.key === 'portfolio') ?? OFFER_PLANS[0]

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
            <h1 className="page-header__title">The research, the Vault, <span className="text-gradient">the picks</span></h1>
            <p className="page-header__subtitle">
              The Research Desk holds everything. The Handicapping Vault and the EdTheStatBot
              Portfolio are sold on their own. Every plan is one payment for 30 or 365 days, and
              nothing renews. Try the Research Desk free for {TRIAL_DAYS} days, no card needed.
            </p>
          </div>
        </div>
      </header>

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

          {trial.onTrial && trial.endsAt && (
            <div className="win-notice win-notice--active">
              ✓ Your free Research Desk trial runs until{' '}
              {new Date(trial.endsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'America/New_York' })}.
              {' '}Nothing is charged when it ends. Pick a plan below to keep going.
            </div>
          )}

          {isPaid && !trial.onTrial && (
            <div className="win-notice win-notice--active">
              ✓ {TIER_SHORT_LABEL[userTier ?? 'retail']} access active
              {expiresAt ? ` until ${expiresAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}.{' '}
              <Link href="/account">View account →</Link>
            </div>
          )}

          <WinPlans
            membership={trial.onTrial ? 'free' : membership}
            currentTier={trial.onTrial ? 'retail' : userTier}
            initialPeriod={initialPeriod}
            selectedPlan={selectedPlan}
            trialAvailable={trial.available}
            onTrial={trial.onTrial}
          />

          <div className="win-disclaimer">
            <p>
              <strong>All sales are final; we do not offer refunds.</strong>{' '}
              See the <Link href="/terms">Terms of Service</Link>.{' '}
              Questions? <Link href="/contact">Contact us</Link>.
            </p>
          </div>

        </div>
      </section>

      {/* The record, under the plans rather than above them (Eddie, Nov 2026):
          the page opens on what is for sale, then shows the proof. */}
      <section className="win-proof" aria-label="The record">
        <div className="container">
          <ProofStrip proof={proof} />
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
                : `The EdTheStatBot Portfolio is ${entry.month.price} for 30 days or ${entry.year.price} for 365, and every graded pick is public before you buy.`}
            </p>
            <div className="cta-box__actions">
              <a href="#plans" className="btn btn--primary btn--lg">
                Choose a Plan <IconArrowRight size={16} />
              </a>
              {isPaid && (
                <Link href="/account" className="btn btn--secondary btn--lg">Your Account</Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
