import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import BlogFilter from '@/components/BlogFilter'

export const metadata: Metadata = {
  title: 'Blog & Insights – EdTheStatMan.com',
  description: 'Expert analysis, betting system breakdowns, and educational content for sports bettors. NFL, NBA, college football & basketball insights.',
  openGraph: {
    title: 'Blog & Insights – EdTheStatMan.com',
    description: 'Expert analysis, betting system breakdowns, and educational content for sports bettors.',
  },
}

export default function Blog() {
  return (
    <main>
      {/* Page Header */}
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">EdTheStatMan</span>
            <h1 className="page-header__title">Blog &amp; Insights</h1>
            <p className="page-header__subtitle">Expert analysis, system breakdowns, and educational content to sharpen your handicapping edge.</p>
          </div>
        </div>
      </header>

      {/* Blog Posts */}
      <section className="section">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Latest Articles</span>
            <h2 className="section-title">Featured <span className="text-gradient">Content</span></h2>
            <p className="section-subtitle">Filter by sport to find the insights that matter most to you.</p>
          </div>
          <BlogFilter />
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center', maxWidth: '560px', margin: '0 auto' }}>
            <span className="section-label">Stay Sharp</span>
            <h2 className="section-title">Get the <span className="text-gradient">Latest</span> in Your Inbox</h2>
            <p className="section-subtitle" style={{ marginBottom: '32px' }}>
              Subscribe for new blog posts, system updates, and exclusive betting insights delivered weekly.
            </p>
            <form className="newsletter newsletter-form reveal-scale" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div className="newsletter" style={{ maxWidth: '100%', margin: '0 auto' }}>
                <input type="email" placeholder="Enter your email" required aria-label="Email address" />
                <button type="submit" className="btn btn--primary">Subscribe</button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <CTASection />
    </main>
  )
}
