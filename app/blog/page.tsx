import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Blog & Insights – EdTheStatMan.com',
  description: 'Expert analysis, betting system breakdowns, and educational content for sports bettors.',
}

export default function Blog() {
  return (
    <main>
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Expert Insights</span>
            <h1 className="page-header__title">Blog & Insights</h1>
            <p className="page-header__subtitle">Expert analysis and educational content for sports bettors.</p>
          </div>
        </div>
      </header>
      {/* Add blog content here */}
    </main>
  )
}
