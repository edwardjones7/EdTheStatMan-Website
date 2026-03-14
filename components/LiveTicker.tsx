'use client'

import { useState } from 'react'
import type { TickerContent, TickerItem } from '@/lib/site-content'
import { DEFAULT_TICKER } from '@/lib/site-content'

interface Props {
  content?: TickerContent
  editMode?: boolean
  onEdit?: (updates: Partial<TickerContent>) => void
}

const BADGE_CLASS: Record<string, string> = {
  up:      'ticker__trend--up',
  down:    'ticker__trend--down',
  neutral: 'ticker__trend--neutral',
}

const BADGE_COLORS: Record<string, string> = {
  up:      'rgba(52,211,153,0.15)',
  down:    'rgba(248,113,113,0.15)',
  neutral: 'rgba(148,163,184,0.15)',
}

const BADGE_TEXT_COLORS: Record<string, string> = {
  up:      '#34d399',
  down:    '#f87171',
  neutral: '#94a3b8',
}

const QUICK_ICONS = ['🏈', '🏀', '⚾', '🏒', '⚽', '🏆', '💰', '📈', '🔥', '✅', '⭐', '🎯']

function ItemPreview({ item }: { item: TickerItem }) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid var(--border)',
      borderRadius: '20px',
      padding: '4px 12px',
      fontSize: '0.78rem',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      maxWidth: '100%',
    }}>
      {item.icon && <span>{item.icon}</span>}
      <span style={{ fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {item.tag || 'Tag'}
      </span>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
        {item.text || 'Text'}
      </span>
      {item.badge && (
        <span style={{
          background: BADGE_COLORS[item.badgeType ?? 'up'],
          color: BADGE_TEXT_COLORS[item.badgeType ?? 'up'],
          borderRadius: '10px',
          padding: '1px 7px',
          fontSize: '0.68rem',
          fontWeight: 700,
        }}>
          {item.badge}
        </span>
      )}
    </div>
  )
}

function TickerItemCard({
  item,
  index,
  onPatch,
  onRemove,
}: {
  item: TickerItem
  index: number
  onPatch: (updates: Partial<TickerItem>) => void
  onRemove: () => void
}) {
  const [showBadge, setShowBadge] = useState(!!(item.badge))

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            background: 'rgba(255,255,255,0.06)',
            borderRadius: '4px',
            padding: '2px 6px',
            flexShrink: 0,
          }}>
            #{index + 1}
          </span>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <ItemPreview item={item} />
          </div>
        </div>
        <button
          onClick={onRemove}
          title="Remove item"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            padding: '2px 6px',
            borderRadius: '4px',
            flexShrink: 0,
            lineHeight: 1,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          ✕
        </button>
      </div>

      {/* Card body */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Row 1: Icon + Tag + Text */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Icon */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={labelStyle}>Icon</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <input
                type="text"
                value={item.icon ?? ''}
                onChange={e => onPatch({ icon: e.target.value })}
                placeholder="—"
                maxLength={4}
                style={{ ...fieldStyle, width: '48px', textAlign: 'center', fontSize: '1.1rem' }}
              />
              <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', width: '48px' }}>
                {QUICK_ICONS.map(ic => (
                  <button
                    key={ic}
                    onClick={() => onPatch({ icon: item.icon === ic ? '' : ic })}
                    title={ic}
                    style={{
                      background: item.icon === ic ? 'rgba(52,211,153,0.18)' : 'transparent',
                      border: item.icon === ic ? '1px solid rgba(52,211,153,0.4)' : '1px solid transparent',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      padding: '2px',
                      lineHeight: 1,
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tag + Text stacked */}
          <div style={{ flex: 1, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px' }}>
              <label style={labelStyle}>Tag / Sport</label>
              <input
                type="text"
                value={item.tag}
                onChange={e => onPatch({ tag: e.target.value })}
                placeholder="e.g. NFL"
                style={{ ...fieldStyle, fontWeight: 700 }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '160px' }}>
              <label style={labelStyle}>Text</label>
              <input
                type="text"
                value={item.text}
                onChange={e => onPatch({ text: e.target.value })}
                placeholder="e.g. Betting Systems: 10-4"
                style={fieldStyle}
              />
            </div>
          </div>
        </div>

        {/* Row 2: Badge toggle + fields */}
        <div>
          <button
            onClick={() => {
              if (showBadge) {
                onPatch({ badge: '', badgeType: 'up' })
              }
              setShowBadge(v => !v)
            }}
            style={{
              background: showBadge ? 'rgba(52,211,153,0.08)' : 'transparent',
              border: `1px solid ${showBadge ? 'rgba(52,211,153,0.3)' : 'var(--border)'}`,
              borderRadius: '5px',
              cursor: 'pointer',
              color: showBadge ? 'var(--accent-green)' : 'var(--text-muted)',
              fontSize: '0.73rem',
              fontWeight: 600,
              padding: '4px 10px',
              letterSpacing: '0.02em',
              transition: 'all 0.15s',
            }}
          >
            {showBadge ? '▾ Badge' : '▸ Add badge'}
          </button>

          {showBadge && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '120px' }}>
                <label style={labelStyle}>Badge text</label>
                <input
                  type="text"
                  value={item.badge ?? ''}
                  onChange={e => onPatch({ badge: e.target.value })}
                  placeholder="e.g. ▲ Hot"
                  style={fieldStyle}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={labelStyle}>Colour</label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {(['up', 'down', 'neutral'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => onPatch({ badgeType: type })}
                      style={{
                        background: (item.badgeType ?? 'up') === type ? BADGE_COLORS[type] : 'transparent',
                        border: `1px solid ${(item.badgeType ?? 'up') === type ? BADGE_TEXT_COLORS[type] : 'var(--border)'}`,
                        borderRadius: '5px',
                        cursor: 'pointer',
                        color: BADGE_TEXT_COLORS[type],
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        padding: '5px 10px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {type === 'up' ? '▲ Green' : type === 'down' ? '▼ Red' : '— Grey'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function LiveTicker({ content = DEFAULT_TICKER, editMode, onEdit }: Props) {
  if (editMode && onEdit) {
    function patchItem(i: number, updates: Partial<TickerItem>) {
      const items = content.items.map((it, j) => j === i ? { ...it, ...updates } : it)
      onEdit!({ items })
    }
    function removeItem(i: number) {
      onEdit!({ items: content.items.filter((_, j) => j !== i) })
    }
    function addItem() {
      onEdit!({ items: [...content.items, { tag: 'New Tag', text: 'New item', icon: '⭐' }] })
    }

    return (
      <div style={{
        background: 'var(--bg-secondary)',
        borderBottom: '2px solid rgba(52,211,153,0.2)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent-cyan)',
              display: 'inline-block',
              boxShadow: '0 0 6px var(--accent-cyan)',
            }} />
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Ticker
            </span>
            <span style={{
              fontSize: '0.68rem',
              color: 'var(--text-muted)',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '10px',
              padding: '1px 7px',
            }}>
              {content.items.length} item{content.items.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            onClick={addItem}
            style={{
              background: 'rgba(52,211,153,0.1)',
              color: 'var(--accent-green)',
              border: '1px solid rgba(52,211,153,0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '5px 12px',
              letterSpacing: '0.02em',
            }}
          >
            + Add Item
          </button>
        </div>

        {/* Items */}
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {content.items.map((item, i) => (
            <TickerItemCard
              key={i}
              item={item}
              index={i}
              onPatch={updates => patchItem(i, updates)}
              onRemove={() => removeItem(i)}
            />
          ))}
          {content.items.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              color: 'var(--text-muted)',
              fontSize: '0.8rem',
              border: '1px dashed var(--border)',
              borderRadius: '8px',
            }}>
              No ticker items. Click "+ Add Item" to get started.
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Normal scrolling ticker — items doubled in JSX for seamless loop ─────────
  const doubled = [...content.items, ...content.items]
  return (
    <div className="ticker">
      <div className="ticker__track">
        {doubled.map((item, i) => (
          <div key={i} className="ticker__item">
            {item.icon && <span style={{ marginRight: '5px' }}>{item.icon}</span>}
            <span className="ticker__sport">{item.tag}</span>
            <span className="ticker__record">{item.text}</span>
            {item.badge && (
              <span className={`ticker__trend ${BADGE_CLASS[item.badgeType ?? 'up'] ?? ''}`}>
                {item.badge}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const fieldStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: '5px',
  padding: '6px 9px',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  fontSize: '0.82rem',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.66rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
}
