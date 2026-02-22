import Link from 'next/link'

export default function Features() {
  return (
    <section className="section" style={{ background: 'var(--bg-secondary)' }}>
      <div className="container">
        <div className="reveal" style={{ textAlign: 'center' }}>
          <span className="section-label">What We Offer</span>
          <h2 className="section-title">Your <span className="text-gradient">Edge</span> Starts Here</h2>
          <p className="section-subtitle" style={{ margin: '0 auto' }}>
            Data-driven tools and analysis to make smarter sports betting decisions.
          </p>
        </div>

        <div className="features-grid stagger-children">
          <div className="feature-card">
            <div className="card__icon card__icon--cyan">&#128202;</div>
            <div className="feature-card__number">01</div>
            <h3 className="feature-card__title">Betting Systems</h3>
            <p className="feature-card__text">
              Proven, data-backed betting systems across NFL, College Football, NBA, and College Basketball. Updated daily with live records.
            </p>
            <Link href="/betting-systems" className="feature-card__link">
              Explore Systems <span>&#8594;</span>
            </Link>
          </div>

          <div className="feature-card">
            <div className="card__icon card__icon--purple">&#128200;</div>
            <div className="feature-card__number">02</div>
            <h3 className="feature-card__title">Betting Trends</h3>
            <p className="feature-card__text">
              Team-by-team trend analysis for every major sport. Discover ATS records, over/under patterns, and situational edges.
            </p>
            <Link href="/betting-trends" className="feature-card__link">
              View Trends <span>&#8594;</span>
            </Link>
          </div>

          <div className="feature-card">
            <div className="card__icon card__icon--green">&#129302;</div>
            <div className="feature-card__number">03</div>
            <h3 className="feature-card__title">EdTheStatBot</h3>
            <p className="feature-card__text">
              Ask questions about our database and get instant statistical insights. AI-powered analysis at your fingertips.
            </p>
            <Link href="/betting-systems" className="feature-card__link">
              Learn More <span>&#8594;</span>
            </Link>
          </div>

          <div className="feature-card">
            <div className="card__icon card__icon--gold">&#127942;</div>
            <div className="feature-card__number">04</div>
            <h3 className="feature-card__title">Proven Results</h3>
            <p className="feature-card__text">
              Full transparency with historical performance records. Track our systems and verify our track record over time.
            </p>
            <Link href="/results" className="feature-card__link">
              See Results <span>&#8594;</span>
            </Link>
          </div>

          <div className="feature-card">
            <div className="card__icon card__icon--cyan">&#128240;</div>
            <div className="feature-card__number">05</div>
            <h3 className="feature-card__title">Expert Blog</h3>
            <p className="feature-card__text">
              In-depth articles explaining key systems, trend breakdowns, and educational content to sharpen your handicapping skills.
            </p>
            <Link href="/blog" className="feature-card__link">
              Read Blog <span>&#8594;</span>
            </Link>
          </div>

          <div className="feature-card">
            <div className="card__icon card__icon--purple">&#128276;</div>
            <div className="feature-card__number">06</div>
            <h3 className="feature-card__title">Instant Alerts</h3>
            <p className="feature-card__text">
              Get notified the moment picks drop via Telegram and Discord. Never miss an edge with real-time betting alerts.
            </p>
            <a href="https://t.me/edthestatman" className="feature-card__link" target="_blank" rel="noopener">
              Join Now <span>&#8594;</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
