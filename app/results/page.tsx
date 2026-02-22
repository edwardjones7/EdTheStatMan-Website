import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Results – EdTheStatMan.com',
  description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
}

export default function Results() {
  return (
    <main>
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Performance</span>
            <h1 className="page-header__title">Results</h1>
            <p className="page-header__subtitle">Historical performance of betting systems with full transparency.</p>
          </div>
        </div>
      </header>
      {/* Add results content here */}
    </main>
  )
}
