import Link from 'next/link'

export default function SystemsOverview() {
  return (
    <section className="section">
      <div className="container">
        <div className="reveal">
          <span className="section-label">Active Systems</span>
          <h2 className="section-title">2026 Betting Systems</h2>
          <p className="section-subtitle">Real-time records across all active sports. Basketball systems are posted daily.</p>
        </div>

        <div className="sys-grid stagger-children">
          {/* NFL */}
          <div className="sys-card sys-card--nfl">
            <div className="sys-card__top">
              <div className="sys-card__icon">&#127944;</div>
              <div className="sys-card__status sys-card__status--ended">Season Ended</div>
            </div>
            <h3 className="sys-card__name">NFL</h3>
            <p className="sys-card__label">Betting Systems</p>
            <div className="sys-card__stats">
              <div className="sys-card__ring" data-pct="23">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" className="sys-card__ring-bg"/>
                  <circle cx="40" cy="40" r="34" className="sys-card__ring-fill" style={{ '--pct': '23' } as React.CSSProperties}/>
                </svg>
                <span className="sys-card__ring-text">23%</span>
              </div>
              <div className="sys-card__numbers">
                <div className="sys-card__record">10-34</div>
                <div className="sys-card__split">
                  <span className="sys-card__w">10 W</span>
                  <span className="sys-card__l">34 L</span>
                </div>
              </div>
            </div>
            <div className="sys-card__bar">
              <div className="sys-card__bar-fill" data-width="23"></div>
            </div>
          </div>

          {/* College Football */}
          <div className="sys-card sys-card--cfb">
            <div className="sys-card__top">
              <div className="sys-card__icon">&#127945;</div>
              <div className="sys-card__status sys-card__status--ended">Season Ended</div>
            </div>
            <h3 className="sys-card__name">College Football</h3>
            <p className="sys-card__label">Betting Systems</p>
            <div className="sys-card__stats">
              <div className="sys-card__ring" data-pct="50">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" className="sys-card__ring-bg"/>
                  <circle cx="40" cy="40" r="34" className="sys-card__ring-fill" style={{ '--pct': '50' } as React.CSSProperties}/>
                </svg>
                <span className="sys-card__ring-text">50%</span>
              </div>
              <div className="sys-card__numbers">
                <div className="sys-card__record">3-3</div>
                <div className="sys-card__split">
                  <span className="sys-card__w">3 W</span>
                  <span className="sys-card__l">3 L</span>
                </div>
              </div>
            </div>
            <div className="sys-card__bar">
              <div className="sys-card__bar-fill" data-width="50"></div>
            </div>
          </div>

          {/* NBA */}
          <div className="sys-card sys-card--nba">
            <div className="sys-card__top">
              <div className="sys-card__icon">&#127936;</div>
              <div className="sys-card__status sys-card__status--active">
                <span className="pulse-dot"></span> Active
              </div>
            </div>
            <h3 className="sys-card__name">NBA</h3>
            <p className="sys-card__label">Betting Systems</p>
            <div className="sys-card__stats">
              <div className="sys-card__ring" data-pct="48">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" className="sys-card__ring-bg"/>
                  <circle cx="40" cy="40" r="34" className="sys-card__ring-fill" style={{ '--pct': '48' } as React.CSSProperties}/>
                </svg>
                <span className="sys-card__ring-text">48%</span>
              </div>
              <div className="sys-card__numbers">
                <div className="sys-card__record">101-108</div>
                <div className="sys-card__split">
                  <span className="sys-card__w">101 W</span>
                  <span className="sys-card__l">108 L</span>
                </div>
              </div>
            </div>
            <div className="sys-card__bar">
              <div className="sys-card__bar-fill" data-width="48"></div>
            </div>
          </div>

          {/* College Basketball */}
          <div className="sys-card sys-card--cbb">
            <div className="sys-card__top">
              <div className="sys-card__icon">&#127936;</div>
              <div className="sys-card__status sys-card__status--hot">
                &#128293; Hot Streak
              </div>
            </div>
            <h3 className="sys-card__name">College Basketball</h3>
            <p className="sys-card__label">Betting Systems</p>
            <div className="sys-card__stats">
              <div className="sys-card__ring" data-pct="100">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" className="sys-card__ring-bg"/>
                  <circle cx="40" cy="40" r="34" className="sys-card__ring-fill" style={{ '--pct': '100' } as React.CSSProperties}/>
                </svg>
                <span className="sys-card__ring-text">100%</span>
              </div>
              <div className="sys-card__numbers">
                <div className="sys-card__record">2-0</div>
                <div className="sys-card__split">
                  <span className="sys-card__w">2 W</span>
                  <span className="sys-card__l">0 L</span>
                </div>
              </div>
            </div>
            <div className="sys-card__bar">
              <div className="sys-card__bar-fill" data-width="100"></div>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '48px' }} className="reveal">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>Records based on calendar year 2026</p>
          <Link href="/betting-systems" className="btn btn--primary">
            View All Betting Systems &#8594;
          </Link>
        </div>
      </div>
    </section>
  )
}
