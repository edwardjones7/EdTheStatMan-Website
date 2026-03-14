'use client'

import Link from 'next/link'
import type { ActionCardContent } from '@/lib/site-content'
import { DEFAULT_ACTION_CARD } from '@/lib/site-content'
import EditableText from './EditableText'

interface Props {
  content?: ActionCardContent
  editMode?: boolean
  onEdit?: (updates: Partial<ActionCardContent>) => void
  resetKey?: number
}

const STATUS_CLASS: Record<string, string> = {
  final:    'action-card__status--final',
  active:   'action-card__status--active',
  upcoming: 'action-card__status--upcoming',
}

export default function ActionCard({ content = DEFAULT_ACTION_CARD, editMode, onEdit, resetKey = 0 }: Props) {
  const ed = editMode && onEdit

  return (
    <section id="todays-action" className="section todays-action">
      <div className="container">
        <div className="reveal">
          <span className="section-label">
            {ed
              ? <EditableText tag="span" value={content.sectionLabel} onChange={v => onEdit({ sectionLabel: v })} resetKey={resetKey} />
              : content.sectionLabel}
          </span>
          <h2 className="section-title">
            {ed
              ? <EditableText tag="span" value={content.sectionTitle} onChange={v => onEdit({ sectionTitle: v })} resetKey={resetKey} style={{ display: 'block' }} />
              : content.sectionTitle}
          </h2>
          <p className="section-subtitle">
            {ed
              ? <EditableText tag="span" value={content.sectionSubtitle} onChange={v => onEdit({ sectionSubtitle: v })} resetKey={resetKey} style={{ display: 'block' }} />
              : content.sectionSubtitle}
          </p>
        </div>

        <div className="action-card reveal" style={{ marginTop: '40px' }}>
          <div className="action-card__header">
            <span className="action-card__date">
              {ed
                ? <EditableText tag="span" value={content.dateHeader} onChange={v => onEdit({ dateHeader: v })} resetKey={resetKey} />
                : content.dateHeader}
            </span>
            <span className={`action-card__status ${STATUS_CLASS[content.statusType] ?? ''}`}>
              <span>&#128308;</span>{' '}
              {ed
                ? (
                  <>
                    <select
                      defaultValue={content.statusType}
                      onChange={e => onEdit({ statusType: e.target.value as ActionCardContent['statusType'] })}
                      style={selectStyle}
                    >
                      <option value="final">Final</option>
                      <option value="active">Active</option>
                      <option value="upcoming">Upcoming</option>
                    </select>
                    {' '}
                    <EditableText tag="span" value={content.statusLabel} onChange={v => onEdit({ statusLabel: v })} resetKey={resetKey} />
                  </>
                )
                : content.statusLabel}
            </span>
          </div>

          <div className="action-card__body">
            <p className="action-card__message">
              {ed
                ? <EditableText tag="span" value={content.message} onChange={v => onEdit({ message: v })} resetKey={resetKey} style={{ display: 'block' }} />
                : content.message}
            </p>

            <div className="action-card__highlight">
              <p>
                &#127942;{' '}
                {ed
                  ? <EditableText tag="span" value={content.highlight} onChange={v => onEdit({ highlight: v })} resetKey={resetKey} />
                  : content.highlight}
              </p>
            </div>

            <div className="action-card__bankroll">
              <p>
                {ed
                  ? <EditableText tag="span" value={content.bankroll} onChange={v => onEdit({ bankroll: v })} resetKey={resetKey} />
                  : content.bankroll}
              </p>
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

const selectStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px dashed rgba(52,211,153,0.45)',
  borderRadius: '4px',
  padding: '2px 6px',
  color: 'inherit',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  cursor: 'pointer',
}
