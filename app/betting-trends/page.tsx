import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Betting Trends – EdTheStatMan.com',
  description: 'Team-by-team betting trends for NFL, NBA, College Football, and College Basketball. ATS records, over/under patterns, and situational edges.',
}

export default function BettingTrends() {
  return (
    <main>
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Trend Analysis</span>
            <h1 className="page-header__title">Betting Trends</h1>
            <p className="page-header__subtitle">Team-by-team trend analysis for every major sport.</p>
          </div>
        </div>
      </header>
      {/* Add betting trends content here */}
    </main>
  )
}
