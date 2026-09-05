'use client'

import Link from 'next/link'
import type { StatBotContent } from '@/lib/site-content'
import EditableText from './EditableText'
import StatBotAvatar from './StatBotAvatar'

/*
 * Marketing teaser only. EdTheStatBot himself is parked on the `ed-the-statbot`
 * branch and is not part of the MVP, so this panel is a mockup: the composer is
 * inert and says so, rather than dispatching a `statbot:ask` event that nothing
 * in this build is listening for.
 *
 * When the bot comes back, that branch restores the live wiring here.
 */

interface Props {
  content: StatBotContent
  editMode?: boolean
  onEdit?: (updates: Partial<StatBotContent>) => void
  resetKey?: number
}

export default function StatBotPreview({ content, editMode, onEdit, resetKey = 0 }: Props) {
  const ed = editMode && onEdit

  function patchBullet(i: number, v: string) {
    if (!onEdit) return
    const bullets = content.bullets.map((b, j) => j === i ? v : b)
    onEdit({ bullets })
  }

  return (
    <section className="section">
      <div className="container">
        <div className="statbot-section reveal-scale">
          <div>
            <span className="section-label">
              {ed
                ? <EditableText tag="span" value={content.label} onChange={v => onEdit({ label: v })} resetKey={resetKey} />
                : content.label}
            </span>
            <h2 className="section-title">
              {ed ? (
                <>
                  <EditableText tag="span" value={content.title} onChange={v => onEdit({ title: v })} resetKey={resetKey} />{' '}
                  <EditableText tag="span" className="text-gradient" value={content.titleAccent} onChange={v => onEdit({ titleAccent: v })} resetKey={resetKey} />
                </>
              ) : (
                <>
                  {content.title}{' '}
                  <span className="text-gradient">{content.titleAccent}</span>
                </>
              )}
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: '1.8' }}>
              {ed
                ? <EditableText tag="span" value={content.description} onChange={v => onEdit({ description: v })} resetKey={resetKey} style={{ display: 'block' }} />
                : content.description}
            </p>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {content.bullets.map((bullet, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                  <span style={{ color: 'var(--accent-teal)' }}>&#10003;</span>
                  {ed
                    ? <EditableText tag="span" value={bullet} onChange={v => patchBullet(i, v)} resetKey={resetKey} />
                    : bullet}
                </li>
              ))}
            </ul>
            <Link href="/vault/systems" className="btn btn--primary">Learn More &#8594;</Link>
          </div>

          <div className="statbot-chat">
            <div className="statbot-chat__header">
              <StatBotAvatar size={36} />
              <div>
                <div className="statbot-chat__name">EdTheStatBot</div>
                <div className="statbot-chat__status">&#9679; Coming soon</div>
              </div>
            </div>
            {/* Illustrative, not a transcript. These are the SHAPES of question
                the bot answers -- deliberately not invented records, because
                the bot itself is forbidden from producing one and printing fake
                numbers beside it would undercut the whole product. */}
            <div className="statbot-chat__messages">
              <div className="chat-message chat-message--user">
                Which NFL road underdog systems have the best record?
              </div>
              <div className="chat-message chat-message--bot">
                Ask and I&apos;ll pull the matching systems from the Vault, each with its
                record, sample size and units. Every number I quote comes from your data,
                and I say so when a sample is too small to mean anything.
              </div>
              <div className="chat-message chat-message--user">
                What moved most since the line opened this week?
              </div>
              <div className="chat-message chat-message--bot">
                I read the same schedule, opening numbers and current numbers your
                membership does. What I can reach depends on your rung.
              </div>
            </div>
            <div className="statbot-chat__input" aria-hidden>
              <input type="text" placeholder="Ask EdTheStatBot a question..." disabled />
              <button type="button" disabled>Ask</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
