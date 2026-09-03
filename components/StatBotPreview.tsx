'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { StatBotContent } from '@/lib/site-content'
import EditableText from './EditableText'
import { IconBot } from './Icons'

/**
 * Asks the real bot. StatBot is mounted separately in the root layout, so this
 * hands the question over by event rather than by lifting shared state through
 * the whole page.
 *
 * The bot now mounts for signed-out visitors too, so the acknowledgement below
 * normally arrives and the question is answered in the panel. The /signup
 * fallback survives for the one case that still has no listener: a click landing
 * in the window before StatBot has hydrated.
 */
function askStatBot(text: string): boolean {
  const value = text.trim()
  if (!value) return false
  const event = new CustomEvent('statbot:ask', { detail: { text: value }, cancelable: true })
  window.dispatchEvent(event)
  // StatBot calls preventDefault() to acknowledge. No listener means no bot.
  return event.defaultPrevented
}

interface Props {
  content: StatBotContent
  editMode?: boolean
  onEdit?: (updates: Partial<StatBotContent>) => void
  resetKey?: number
}

export default function StatBotPreview({ content, editMode, onEdit, resetKey = 0 }: Props) {
  const ed = editMode && onEdit
  const [question, setQuestion] = useState('')
  const router = useRouter()

  function ask(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return
    if (askStatBot(question)) setQuestion('')
    else router.push('/signup?next=/')
  }

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
              <div className="statbot-chat__avatar"><IconBot size={20} /></div>
              <div>
                <div className="statbot-chat__name">EdTheStatBot</div>
                <div className="statbot-chat__status">&#9679; Online</div>
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
            <form className="statbot-chat__input" onSubmit={ask}>
              <input
                type="text"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Ask EdTheStatBot a question..."
                aria-label="Ask EdTheStatBot a question"
              />
              <button type="submit">Ask</button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
