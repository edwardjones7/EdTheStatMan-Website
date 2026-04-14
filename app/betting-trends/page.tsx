import type { Metadata } from 'next'
import Link from 'next/link'
import CTASection from '@/components/CTASection'
import TrendsFilter from '@/components/TrendsFilter'
import CheckoutButton from '@/components/CheckoutButton'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Betting Trends',
  description: 'Betting trends for NFL, NBA, College Football, and College Basketball. Situational edges with win percentages and unit performance.',
  alternates: { canonical: 'https://edthestatman.com/betting-trends' },
  openGraph: {
    title: 'Betting Trends – EdTheStatMan.com',
    description: 'Betting trends for NFL, NBA, College Football, and College Basketball. Situational edges with win percentages and unit performance.',
    url: 'https://edthestatman.com/betting-trends',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Betting Trends – EdTheStatMan.com',
    description: 'Betting trends for NFL, NBA, College Football, and College Basketball. Situational edges with win percentages and unit performance.',
    images: ['/opengraph-image'],
  },
}

export default async function BettingTrends() {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userTier: string | null = null
  let isAdmin = false
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('subscription_tier, is_admin, access_expires_at')
      .eq('id', user.id)
      .single()
    if ((profile as any)?.is_admin) {
      isAdmin = true
      userTier = 'premium'
    } else {
      userTier = (profile as any)?.subscription_tier ?? 'free'
      if (userTier !== 'free') {
        const expiresAt = (profile as any)?.access_expires_at ? new Date((profile as any).access_expires_at) : null
        if (!expiresAt || expiresAt < new Date()) userTier = 'free'
      }
    }
  }

  const trendsQuery = isAdmin
    ? (admin as any).from('betting_trends').select('*').order('team', { ascending: true }).order('created_at', { ascending: false })
    : (admin as any).from('betting_trends').select('*').eq('is_active', true).order('team', { ascending: true }).order('created_at', { ascending: false })

  const { data: trends } = await trendsQuery

  const isPaid = userTier === 'basic' || userTier === 'premium'

  return (
    <main>
      <section className="section">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Explore Trends</span>
            <h2 className="section-title">Betting Trends</h2>
            <p className="section-subtitle">Filter by sport to discover situational edges and patterns.</p>
          </div>
          <TrendsFilter trends={(trends ?? []) as any[]} userTier={userTier} isAdmin={isAdmin} />
        </div>
      </section>

      {!isPaid && (
        <section className="section" style={{ background: 'var(--bg-secondary)' }} id="pricing">
          <div className="container">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <span className="section-label">Membership</span>
              <h2 className="section-title">Choose Your <span className="text-gradient">Plan</span></h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>
                Unlock full access to betting trends, systems, and instant alerts.
              </p>
            </div>

            <div className="pricing-grid stagger-children" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', maxWidth: '800px', margin: '60px auto 0' }}>
              <div className="pricing-card reveal-scale">
                <div className="pricing-card__name">Monthly</div>
                <div className="pricing-card__price">$19.99<span>/mo</span></div>
                <div className="pricing-card__desc">Full access, billed monthly</div>
                <ul className="pricing-card__features">
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Full betting systems</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> All trends unlocked</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> X &amp; Discord alerts</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Cancel anytime</li>
                </ul>
                <CheckoutButton
                  priceId={process.env.NEXT_PUBLIC_STRIPE_BASIC_PRICE_ID!}
                  label="Get Started"
                  variant="outline"
                />
              </div>

              <div className="pricing-card pricing-card--featured reveal-scale">
                <div className="pricing-card__name">Annual</div>
                <div className="pricing-card__price">$119.99<span>/yr</span></div>
                <div className="pricing-card__desc">Full access, billed yearly — save $119.89</div>
                <ul className="pricing-card__features">
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Full betting systems</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> All trends unlocked</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> X &amp; Discord alerts</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Cancel anytime</li>
                </ul>
                <CheckoutButton
                  priceId={process.env.NEXT_PUBLIC_STRIPE_PREMIUM_PRICE_ID!}
                  label="Get Annual →"
                  variant="primary"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <CTASection />
    </main>
  )
}
