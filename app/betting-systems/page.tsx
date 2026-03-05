import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import SportTabsSystem from '@/components/SportTabsSystem'

export const metadata: Metadata = {
  title: 'Betting Systems – EdTheStatMan.com',
  description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
  openGraph: {
    title: 'Betting Systems – EdTheStatMan.com',
    description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
  },
}

export default function BettingSystems() {
  return (
    <main>
      {/* Page Header */}
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">2026 Records</span>
            <h1 className="page-header__title">Betting Systems</h1>
            <p className="page-header__subtitle">Active betting systems across NFL, College Football, NBA, and College Basketball. Records based on calendar year.</p>
          </div>
        </div>
      </header>

      {/* Membership Pricing */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
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
              <a href="https://t.me/edthestatman" className="btn btn--outline" style={{ width: '100%', justifyContent: 'center' }} target="_blank" rel="noopener">
                Get Started
              </a>
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
              <a href="https://t.me/edthestatman" className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} target="_blank" rel="noopener">
                Get Premium &#8594;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Sport Tabs & Systems Table */}
      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal">
            <span className="section-label">Active Systems</span>
            <h2 className="section-title">Current Betting Systems</h2>
            <p className="section-subtitle">Filter by sport to view system records, streaks, and status.</p>
          </div>
          <SportTabsSystem />
        </div>
      </section>

      <CTASection />
    </main>
  )
}
