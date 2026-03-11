import Link from 'next/link'
import type { StatBotContent } from '@/lib/site-content'
import AdminEditOverlay from './AdminEditOverlay'

interface Props {
  content: StatBotContent
  isAdmin?: boolean
}

export default function StatBotPreview({ content, isAdmin }: Props) {
  return (
    <section className="section" style={{ position: 'relative' }}>
      {isAdmin && <AdminEditOverlay section="statbot_preview" label="StatBot Preview" />}

      <div className="container">
        <div className="statbot-section reveal-scale">
          <div>
            <span className="section-label">{content.label}</span>
            <h2 className="section-title">
              {content.title} <span className="text-gradient">{content.titleAccent}</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.8' }}>
              {content.description}
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {content.bullets.map((bullet, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent-green)' }}>&#10003;</span> {bullet}
                </li>
              ))}
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
