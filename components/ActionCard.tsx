import Link from 'next/link'

export default function ActionCard() {
  return (
    <section id="todays-action" className="section todays-action">
      <div className="container">
        <div className="reveal">
          <span className="section-label">Today&apos;s Action</span>
          <h2 className="section-title">Monday February 16th, 2026</h2>
          <p className="section-subtitle">Stay updated with the latest picks, active systems, and daily analysis.</p>
        </div>

        <div className="action-card reveal" style={{ marginTop: '40px' }}>
          <div className="action-card__header">
            <span className="action-card__date">Monday, February 16th 2026 &mdash; Final Update</span>
            <span className="action-card__status action-card__status--final">
              <span>&#128308;</span> Final Update
            </span>
          </div>
          <div className="action-card__body">
            <p className="action-card__message">
              No Betting Systems are active on Monday. Check back tomorrow for updated systems and picks.
            </p>

            <div className="action-card__highlight">
              <p>&#127942; Super Bowl LX Betting Systems were <strong>19-4 ATS</strong>, and <strong>17-1 ATS</strong> in the Super Bowl &mdash; both proved to be winners with the Seahawks.</p>
            </div>

            <div className="action-card__bankroll">
              <p>Bankroll stands at <span>+10.19%</span> for 2026.</p>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <a href="https://t.me/edthestatman" className="btn btn--primary btn--sm" target="_blank" rel="noopener">
                &#9889; Get Picks on Telegram
              </a>
              <a href="https://discord.gg/gqPrVBg4Aw" className="btn btn--secondary btn--sm" target="_blank" rel="noopener">
                &#128172; Join Discord
              </a>
              <Link href="/betting-systems" className="btn btn--outline btn--sm">
                &#128202; View All Systems
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
