import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import SportTabsSystem from '@/components/SportTabsSystem'
import CheckoutButton from '@/components/CheckoutButton'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Betting Systems',
  description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
  alternates: { canonical: 'https://edthestatman.com/betting-systems' },
  openGraph: {
    title: 'Betting Systems – EdTheStatMan.com',
    description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
    url: 'https://edthestatman.com/betting-systems',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Betting Systems – EdTheStatMan.com',
    description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
    images: ['/opengraph-image'],
  },
}

export default async function BettingSystems() {
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

  const systemsQuery = isAdmin
    ? (admin as any).from('betting_systems').select('*').order('date', { ascending: true, nullsFirst: false })
    : (admin as any).from('betting_systems').select('*').eq('is_active', true).order('date', { ascending: true, nullsFirst: false })

  const { data: systems } = await systemsQuery

  const isPaid = userTier === 'basic' || userTier === 'premium'

  return (
    <main>
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
                <div className="pricing-card__name">Monthly</div>
                <div className="pricing-card__price">$19.99<span>/mo</span></div>
                <div className="pricing-card__desc">Full access, billed monthly</div>
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
                <div className="pricing-card__name">Annual</div>
                <div className="pricing-card__price">$119.99<span>/yr</span></div>
                <div className="pricing-card__desc">Full access, billed yearly — save $119.89</div>
                <ul className="pricing-card__features">
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Full betting systems</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> All trends unlocked</li>
                  <li className="pricing-card__feature"><span className="check">&#10003;</span> Telegram alerts</li>
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

      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal">
            <span className="section-label">Active Systems</span>
            <h2 className="section-title">Betting Systems</h2>
            <p className="section-subtitle">Filter by sport to view system records, win percentages, and more.</p>
          </div>
          <SportTabsSystem systems={(systems ?? []) as any[]} userTier={userTier} isAdmin={isAdmin} />
        </div>
      </section>

      <CTASection />
    </main>
  )
}
