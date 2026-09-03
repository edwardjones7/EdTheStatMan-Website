'use client'

import Link from 'next/link'
import type { SystemsOverviewContent, SystemsOverviewCard } from '@/lib/site-content'
import EditableText from './EditableText'
import { IconFootball, IconBasketball, IconFlame } from './Icons'
import RecordStrip from './RecordStrip'

interface Props {
  content: SystemsOverviewContent
  editMode?: boolean
  onEdit?: (updates: Partial<SystemsOverviewContent>) => void
  resetKey?: number
}

const SPORT_ICONS: Record<string, typeof IconFootball> = {
  nfl: IconFootball,
  cfb: IconFootball,
  nba: IconBasketball,
  cbb: IconBasketball,
}

export default function SystemsOverview({ content, editMode, onEdit, resetKey = 0 }: Props) {
  const ed = editMode && onEdit

  function patchCard(i: number, updates: Partial<SystemsOverviewCard>) {
    if (!onEdit) return
    const cards = content.cards.map((c, j) => j === i ? { ...c, ...updates } : c)
    onEdit({ cards })
  }

  return (
    <section className="section">
      <div className="container">
        <div className="reveal">
          <span className="section-label">
            {ed
              ? <EditableText tag="span" value={content.label} onChange={v => onEdit({ label: v })} resetKey={resetKey} />
              : content.label}
          </span>
          <h2 className="section-title">
            {ed
              ? <EditableText tag="span" value={content.title} onChange={v => onEdit({ title: v })} resetKey={resetKey} style={{ display: 'block' }} />
              : content.title}
          </h2>
          <p className="section-subtitle">
            {ed
              ? <EditableText tag="span" value={content.subtitle} onChange={v => onEdit({ subtitle: v })} resetKey={resetKey} style={{ display: 'block' }} />
              : content.subtitle}
          </p>
        </div>

        <div className="sys-grid stagger-children">
          {content.cards.filter(c => c.statusType !== 'ended').map((card, i) => {
            const total = card.wins + card.losses
            const pct = total > 0 ? Math.round((card.wins / total) * 100) : 0
            const record = `${card.wins}-${card.losses}`

            return (
              <div key={i} className={`sys-card sys-card--${card.sport}`}>
                <div className="sys-card__top">
                  <div className="sys-card__icon">
                    {(() => { const Icon = SPORT_ICONS[card.sport] ?? IconBasketball; return <Icon size={22} /> })()}
                  </div>
                  <div className={`sys-card__status sys-card__status--${card.statusType}`}>
                    {card.statusType === 'active' && <span className="pulse-dot"></span>}
                    {card.statusType === 'hot' && <IconFlame size={13} />}
                    {ed
                      ? <EditableText tag="span" value={card.statusLabel} onChange={v => patchCard(i, { statusLabel: v })} resetKey={resetKey} />
                      : card.statusLabel}
                  </div>
                </div>

                <h3 className="sys-card__name">
                  {ed
                    ? <EditableText tag="span" value={card.name} onChange={v => patchCard(i, { name: v })} resetKey={resetKey} style={{ display: 'block' }} />
                    : card.name}
                </h3>
                <p className="sys-card__label">Betting Systems</p>

                <div className="sys-card__stats">
                  <div className="sys-card__pct">{pct}%</div>
                  <div className="sys-card__numbers">
                    {ed ? (
                      <RecordInput
                        wins={card.wins}
                        losses={card.losses}
                        onChange={(w, l) => patchCard(i, { wins: w, losses: l })}
                        resetKey={resetKey}
                      />
                    ) : (
                      <>
                        <div className="sys-card__record">{record}</div>
                        <div className="sys-card__split">
                          <span className="sys-card__w">{card.wins} W</span>
                          <span className="sys-card__l">{card.losses} L</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <RecordStrip w={card.wins} l={card.losses} />
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: '48px' }} className="reveal">
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            {ed
              ? <EditableText tag="span" value={content.footerNote} onChange={v => onEdit({ footerNote: v })} resetKey={resetKey} />
              : content.footerNote}
          </p>
          <Link href="/vault/systems" className="btn btn--primary">
            View All Betting Systems &#8594;
          </Link>
        </div>
      </div>
    </section>
  )
}

// Editable W-L record input — shows "10-34", updates wins + losses on blur
function RecordInput({ wins, losses, onChange, resetKey }: {
  wins: number
  losses: number
  onChange: (w: number, l: number) => void
  resetKey: number
}) {
  return (
    <div>
      <input
        key={resetKey}
        type="text"
        defaultValue={`${wins}-${losses}`}
        onBlur={e => {
          const match = e.target.value.match(/^(\d+)[^0-9]+(\d+)$/)
          if (match) onChange(parseInt(match[1]), parseInt(match[2]))
        }}
        placeholder="W-L"
        style={{
          background: 'transparent',
          border: 'none',
          borderBottom: '1px dashed rgba(45,212,191,0.55)',
          outline: 'none',
          color: 'var(--text-primary)',
          fontSize: '1.1rem',
          fontWeight: 700,
          fontFamily: 'var(--font-mono, monospace)',
          width: '80px',
          textAlign: 'center',
          cursor: 'text',
          padding: '2px 0',
        }}
      />
      <div className="sys-card__split" style={{ marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        W – L
      </div>
    </div>
  )
}
