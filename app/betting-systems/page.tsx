import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Betting Systems – EdTheStatMan.com',
  description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
  openGraph: {
    title: 'Betting Systems – EdTheStatMan.com',
    description: 'Active betting systems for NFL, College Football, NBA, and College Basketball. Data-driven picks with proven track records.',
    url: 'https://edwardjones7.github.io/EdTheStatMan-Website/betting-systems',
  },
}

export default function BettingSystems() {
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
      {/* Add betting systems content here */}
    </main>
  )
}
