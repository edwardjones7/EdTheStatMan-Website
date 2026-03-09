import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import SportTabsSystem from '@/components/SportTabsSystem'
import CheckoutButton from '@/components/CheckoutButton'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  title: 'Betting Systems – EdTheStatMan.com',
  description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
  openGraph: {
    title: 'Betting Systems – EdTheStatMan.com',
    description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
  },
}

export default async function BettingSystems() {
  const admin = createAdminClient()
  const supabase = await createClient()
  const [{ data: systems }, { data: { session } }] = await Promise.all([
    (admin as any).from('betting_systems').select('*').order('sort_order', { ascending: true }),
    supabase.auth.getSession(),
  ])

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
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">2026 Records</span>
            <h1 className="page-header__title">Betting Systems</h1>
            <p className="page-header__subtitle">Active betting systems across NFL, College Football, NBA, and College Basketball. Records based on calendar year.</p>
          </div>
        </div>
      </header>

      {/* Pricing — only show to non-paid users */}
      {!isPaid && (
        <section className="section" style={{ background: 'var(--bg-secondary)' }} id="pricing">
          <div className="container">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <span className="section-label">Membership</span>
              <h2 className="section-title">Choose Your <span className="text-gradient">Plan</span></h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>
                Unlock full access to betting systems, trends, and instant alerts.
              </p>
            </div>

            <div className="pricing-grid stagger-children" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', maxWidth: '800px', margin: '60px auto 0' }}>
              <div className="pricing-card reveal-scale">
                <div className="pricing-card__name">Basic</div>
                <div className="pricing-card__price">$19<span>/mo</span></div>
                <div className="pricing-card__desc">Essential betting systems access</div>
                <ul className="pricing-card__features">
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Full betting systems</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> All trends unlocked</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Telegram alerts</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Cancel anytime</li>
                </ul>
                <CheckoutButton
                  priceId={process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID!}
                  label="Get Started"
                  variant="outline"
                />
              </div>

              <div className="pricing-card pricing-card--featured reveal-scale">
                <div className="pricing-card__name">Premium</div>
                <div className="pricing-card__price">$119<span>/mo</span></div>
                <div className="pricing-card__desc">Complete access with premium features</div>
                <ul className="pricing-card__features">
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Everything in Basic</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> EdTheStatBot access</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Priority support</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Early access to new features</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Advanced analytics</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Cancel anytime</li>
                </ul>
                <CheckoutButton
                  priceId={process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID!}
                  label="Get Premium →"
                  variant="primary"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal">
            <span className="section-label">Active Systems</span>
            <h2 className="section-title">Current Betting Systems</h2>
            <p className="section-subtitle">Filter by sport to view system records, streaks, and status.</p>
          </div>
          <SportTabsSystem systems={(systems ?? []) as any[]} userTier={userTier} />
        </div>
      </section>

      <CTASection />
    </main>
  )
}
