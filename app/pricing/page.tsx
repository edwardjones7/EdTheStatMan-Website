import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import CheckoutButton from '@/components/CheckoutButton'
import CTASection from '@/components/CTASection'

export const metadata: Metadata = {
  title: 'Pricing – EdTheStatMan.com',
  description: 'Choose a plan to unlock full access to betting systems, trends, and expert analysis. Basic $19/mo or Premium $119/mo.',
  openGraph: {
    title: 'Pricing – EdTheStatMan.com',
    description: 'Unlock full access to betting systems, trends, and expert analysis.',
  },
}

export default async function Pricing() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  let userTier: string | null = null
  if (session) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('subscription_tier, subscription_status, is_admin')
      .eq('id', session.user.id)
      .single()
    if ((profile as any)?.is_admin) {
      userTier = 'premium'
    } else {
      userTier = (profile as any)?.subscription_tier ?? 'free'
      if (userTier !== 'free' && (profile as any)?.subscription_status !== 'active') {
        userTier = 'free'
      }
    }
  }

  const isPaid = userTier === 'basic' || userTier === 'premium'

  return (
    <main>
      {/* Header */}
      <header className="page-header">
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">Membership</span>
            <h1 className="page-header__title">Simple, Transparent <span className="text-gradient">Pricing</span></h1>
            <p className="page-header__subtitle">
              Unlock full access to betting systems, trends, expert analysis, and instant alerts.
              Cancel anytime — no contracts, no surprises.
            </p>
          </div>
        </div>
      </header>

      {/* Pricing cards */}
      <section className="section">
        <div className="container">

          {isPaid && (
            <div className="reveal" style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(52,211,153,0.1)',
                border: '1px solid rgba(52,211,153,0.3)',
                borderRadius: '10px',
                padding: '12px 24px',
                color: 'var(--accent-green)',
                fontWeight: 600,
              }}>
                ✓ You&apos;re subscribed to the {userTier === 'premium' ? 'Premium' : 'Basic'} plan.{' '}
                <Link href="/account" style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>
                  Manage billing →
                </Link>
              </div>
            </div>
          )}

          <div className="pricing-grid stagger-children" style={{ maxWidth: '820px', margin: '0 auto' }}>

            {/* Free */}
            <div className="pricing-card reveal-scale">
              <div className="pricing-card__name">Free</div>
              <div className="pricing-card__price">$0<span>/mo</span></div>
              <div className="pricing-card__desc">A taste of what's available</div>
              <ul className="pricing-card__features">
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Curated free betting systems</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Free-tagged trends</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Free blog posts</li>
                <li className="pricing-card__feature pricing-card__feature--muted"><span className="cross">&#10007;</span> Full systems library</li>
                <li className="pricing-card__feature pricing-card__feature--muted"><span className="cross">&#10007;</span> All betting trends</li>
              </ul>
              {!session ? (
                <Link href="/signup" className="btn btn--outline" style={{ width: '100%', justifyContent: 'center' }}>
                  Create Free Account
                </Link>
              ) : userTier === 'free' ? (
                <button className="btn btn--outline" style={{ width: '100%', justifyContent: 'center' }} disabled>
                  Current Plan
                </button>
              ) : null}
            </div>

            {/* Basic */}
            <div className="pricing-card reveal-scale">
              <div className="pricing-card__name">Basic</div>
              <div className="pricing-card__price">$19<span>/mo</span></div>
              <div className="pricing-card__desc">Essential betting access</div>
              <ul className="pricing-card__features">
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Full betting systems library</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> All betting trends unlocked</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> All blog posts</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Telegram &amp; Discord alerts</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Cancel anytime</li>
              </ul>
              {userTier === 'basic' ? (
                <button className="btn btn--outline" style={{ width: '100%', justifyContent: 'center' }} disabled>
                  Current Plan
                </button>
              ) : !isPaid ? (
                <CheckoutButton
                  priceId={process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID!}
                  label="Get Started"
                  variant="outline"
                />
              ) : null}
            </div>

            {/* Premium */}
            <div className="pricing-card pricing-card--featured reveal-scale">
              <div className="pricing-card__name">Premium</div>
              <div className="pricing-card__price">$119<span>/mo</span></div>
              <div className="pricing-card__desc">Complete access with premium features</div>
              <ul className="pricing-card__features">
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Everything in Basic</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> EdTheStatBot access</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Priority support</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Early access to features</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Advanced analytics</li>
                <li className="pricing-card__feature"><span className="check">&#10003;</span> Cancel anytime</li>
              </ul>
              {userTier === 'premium' ? (
                <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} disabled>
                  Current Plan
                </button>
              ) : !isPaid ? (
                <CheckoutButton
                  priceId={process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID!}
                  label="Get Premium →"
                  variant="primary"
                />
              ) : userTier === 'basic' ? (
                <CheckoutButton
                  priceId={process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID!}
                  label="Upgrade to Premium →"
                  variant="primary"
                />
              ) : null}
            </div>

          </div>

          {/* FAQ strip */}
          <div className="reveal" style={{ maxWidth: '640px', margin: '64px auto 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.8 }}>
              All plans billed monthly. Cancel anytime from your{' '}
              <Link href="/account" style={{ color: 'var(--accent-cyan)' }}>account page</Link>.
              Questions? <Link href="/contact" style={{ color: 'var(--accent-cyan)' }}>Contact us</Link>.
            </p>
          </div>

        </div>
      </section>

      <CTASection />
    </main>
  )
}
