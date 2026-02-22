import Link from 'next/link'

export default function StatBotPreview() {
  return (
    <section className="section">
      <div className="container">
        <div className="statbot-section reveal-scale">
          <div>
            <span className="section-label">Coming Soon</span>
            <h2 className="section-title">Meet <span className="text-gradient">EdTheStatBot</span></h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.8' }}>
              Ask questions. Get answers. Our AI-powered statistical assistant lets you query our entire database for trends, records, and insights across every sport we cover.
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-green)' }}>&#10003;</span> Query team ATS records in any situation
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-green)' }}>&#10003;</span> Find over/under trends by team and venue
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-green)' }}>&#10003;</span> Discover edges with custom filters
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                <span style={{ color: 'var(--accent-green)' }}>&#10003;</span> Natural language &mdash; no coding required
              </li>
            </ul>
            <Link href="/betting-systems" className="btn btn--primary">Learn More &#8594;</Link>
          </div>

          <div className="statbot-chat">
            <div className="statbot-chat__header">
              <div className="statbot-chat__avatar">&#129302;</div>
              <div>
                <div className="statbot-chat__name">EdTheStatBot</div>
                <div className="statbot-chat__status">&#9679; Online</div>
              </div>
            </div>
            <div className="statbot-chat__messages">
              <div className="chat-message chat-message--user">
                What&apos;s the Lakers ATS record as home underdogs this season?
              </div>
              <div className="chat-message chat-message--bot">
                The Lakers are 7-2 ATS as home underdogs this season, covering by an average of 4.3 points. This represents one of the strongest situational trends in the NBA this year.
              </div>
              <div className="chat-message chat-message--user">
                How about Chiefs games and the over?
              </div>
              <div className="chat-message chat-message--bot">
                The over has hit in 8 of the last 10 Chiefs games, with an average combined score of 51.2 points. Particularly strong in primetime matchups (6-1 over).
              </div>
            </div>
            <div className="statbot-chat__input">
              <input type="text" placeholder="Ask EdTheStatBot a question..." />
              <button>Ask</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
