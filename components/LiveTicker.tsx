'use client'

import { useEffect, useRef } from 'react'
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

const QUICK_ICONS = ['🏈', '🏀', '⚾', '🏒', '⚽', '🏆', '💰', '📈', '🔥', '✅', '⭐']

export default function LiveTicker({ content = DEFAULT_TICKER, editMode, onEdit }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editMode) return
    const track = trackRef.current
    if (!track) return
    const original = track.innerHTML
    track.innerHTML = original + original
  }, [editMode, content.items])

  // ── Edit mode: expanded row editor ──────────────────────────────────────────
  if (editMode && onEdit) {
    const emit = onEdit
    function patchItem(i: number, updates: Partial<TickerItem>) {
      const items = content.items.map((it, j) => j === i ? { ...it, ...updates } : it)
      emit({ items })
    }
    function removeItem(i: number) {
      const items = content.items.filter((_, j) => j !== i)
      emit({ items })
    }
    function addItem() {
      const items = [...content.items, { tag: 'New Tag', text: 'New item', icon: '' }]
      emit({ items })
    }

    return (
      <div style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        padding: '12px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            ✏ Ticker Editor
          </span>
          <button
            onClick={addItem}
            style={{ ...btnStyle, background: 'rgba(52,211,153,0.12)', color: 'var(--accent-green)', border: '1px solid rgba(52,211,153,0.3)' }}
          >
            + Add Item
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {content.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>

              {/* Icon picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="text"
                  value={item.icon ?? ''}
                  onChange={e => patchItem(i, { icon: e.target.value })}
                  placeholder="icon"
                  maxLength={4}
                  style={{ ...fieldStyle, width: '44px', textAlign: 'center', fontSize: '1rem' }}
                  title="Emoji icon"
                />
                <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', maxWidth: '130px' }}>
                  {QUICK_ICONS.map(ic => (
                    <button
                      key={ic}
                      onClick={() => patchItem(i, { icon: ic })}
                      title={ic}
                      style={{
                        background: item.icon === ic ? 'rgba(52,211,153,0.2)' : 'transparent',
                        border: item.icon === ic ? '1px solid rgba(52,211,153,0.5)' : '1px solid transparent',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        padding: '1px 3px',
                        lineHeight: 1,
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tag */}
              <input
                type="text"
                value={item.tag}
                onChange={e => patchItem(i, { tag: e.target.value })}
                placeholder="Tag"
                style={{ ...fieldStyle, width: '130px', fontWeight: 700 }}
                title="Tag label"
              />

              {/* Record text */}
              <input
                type="text"
                value={item.text}
                onChange={e => patchItem(i, { text: e.target.value })}
                placeholder="Record / text"
                style={{ ...fieldStyle, flex: 1, minWidth: '160px' }}
                title="Main text"
              />

              {/* Badge text */}
              <input
                type="text"
                value={item.badge ?? ''}
                onChange={e => patchItem(i, { badge: e.target.value })}
                placeholder="Badge (optional)"
                style={{ ...fieldStyle, width: '110px' }}
                title="Badge text e.g. ▲ Hot"
              />

              {/* Badge colour */}
              <select
                value={item.badgeType ?? 'up'}
                onChange={e => patchItem(i, { badgeType: e.target.value as TickerItem['badgeType'] })}
                style={{ ...fieldStyle, width: '90px' }}
                title="Badge colour"
              >
                <option value="up">▲ Green</option>
                <option value="down">▼ Red</option>
                <option value="neutral">— Grey</option>
              </select>

              {/* Delete */}
              <button
                onClick={() => removeItem(i)}
                title="Remove item"
                style={{ ...btnStyle, color: '#f87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', flexShrink: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Normal scrolling ticker ──────────────────────────────────────────────────
  return (
    <div className="ticker">
      <div className="ticker__track" ref={trackRef}>
        {content.items.map((item, i) => (
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
  padding: '5px 8px',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  fontSize: '0.82rem',
}

const btnStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: '5px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.8rem',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}
