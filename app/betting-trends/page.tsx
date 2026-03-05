import type { Metadata } from 'next'
import Link from 'next/link'
import CTASection from '@/components/CTASection'
import TrendsFilter from '@/components/TrendsFilter'

export const metadata: Metadata = {
  title: 'Betting Trends – EdTheStatMan.com',
  description: 'Team-by-team betting trends for NFL, NBA, College Football, and College Basketball. ATS records, over/under patterns, and situational edges.',
  openGraph: {
    title: 'Betting Trends – EdTheStatMan.com',
    description: 'Team-by-team betting trends for NFL, NBA, College Football, and College Basketball. ATS records, over/under patterns, and situational edges.',
  },
}

export default function BettingTrends() {
  return (
    <main>
      {/* Page Header */}
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Team-by-Team Analysis</span>
            <h1 className="page-header__title">Betting Trends</h1>
            <p className="page-header__subtitle">ATS records, over/under patterns, home/away splits, and situational trends for every team across NFL, College Football, NBA, and College Basketball.</p>
          </div>
        </div>
      </header>

      {/* Trends Section */}
      <section className="section">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Explore Trends</span>
            <h2 className="section-title">Team Betting Trends</h2>
            <p className="section-subtitle">Filter by sport and search for teams to discover ATS and O/U patterns.</p>
          </div>
          <TrendsFilter />
        </div>
      </section>

      {/* Upgrade Membership CTA */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">Unlock Full Access</span>
            <h2 className="section-title">Get All <span className="text-gradient">15+ Trends</span> Per Team</h2>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              Pro members get unlimited access to every trend: situational splits, rest patterns, conference play, and more.
            </p>
          </div>

          <div className="cta-box reveal-scale" style={{ marginTop: '40px' }}>
            <h2 className="cta-box__title">
              Upgrade to Pro. <span className="text-gradient">Unlock Every Edge.</span>
            </h2>
            <p className="cta-box__text">
              Join Pro to access all betting trends, full betting systems, Telegram alerts, and EdTheStatBot.
            </p>
            <div className="cta-box__actions">
              <a href="https://t.me/edthestatman" className="btn btn--primary btn--lg" target="_blank" rel="noopener">
                <span className="btn__icon">&#9889;</span> Upgrade to Pro
              </a>
              <Link href="/betting-systems" className="btn btn--secondary btn--lg">
                View Plans
              </Link>
            </div>
          </div>
        </div>
      </section>

      <CTASection />
    </main>
  )
}
