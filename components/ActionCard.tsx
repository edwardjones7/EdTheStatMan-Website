'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ActionCardContent } from '@/lib/site-content'
import { DEFAULT_ACTION_CARD } from '@/lib/site-content'

interface Props {
  content?: ActionCardContent
  isAdmin?: boolean
}

const STATUS_CLASS: Record<string, string> = {
  final:    'action-card__status--final',
  active:   'action-card__status--active',
  upcoming: 'action-card__status--upcoming',
}

export default function ActionCard({ content = DEFAULT_ACTION_CARD, isAdmin }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ActionCardContent>(content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function startEdit() {
    setDraft(content)
    setEditing(true)
    setError(null)
  }

  function cancelEdit() {
    setEditing(false)
    setError(null)
  }

  async function saveEdit() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'action_card', value: draft }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Save failed')
      } else {
        setEditing(false)
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  function set(field: keyof ActionCardContent, value: string) {
    setDraft(prev => ({ ...prev, [field]: value }))
  }

  const c = editing ? draft : content

  return (
    <>
    <section id="todays-action" className="section todays-action" style={{ position: 'relative' }}>
      <div className="container">
        <div className="reveal">
          {editing ? (
            <>
              <EditInput value={draft.sectionLabel} onChange={v => set('sectionLabel', v)} placeholder="Section label" small />
              <EditInput value={draft.sectionTitle} onChange={v => set('sectionTitle', v)} placeholder="Section heading" heading />
              <EditInput value={draft.sectionSubtitle} onChange={v => set('sectionSubtitle', v)} placeholder="Section subtitle" />
            </>
          ) : (
            <>
              <span className="section-label">{c.sectionLabel}</span>
              <h2 className="section-title">{c.sectionTitle}</h2>
              <p className="section-subtitle">{c.sectionSubtitle}</p>
            </>
          )}
        </div>

        <div className="action-card reveal" style={{ marginTop: '40px', position: 'relative' }}>


          <div className="action-card__header">
            {editing ? (
              <>
                <EditInput value={draft.dateHeader} onChange={v => set('dateHeader', v)} placeholder="Date header" />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <select
                    value={draft.statusType}
                    onChange={e => set('statusType', e.target.value)}
                    style={selectStyle}
                  >
                    <option value="final">Final</option>
                    <option value="active">Active</option>
                    <option value="upcoming">Upcoming</option>
                  </select>
                  <EditInput value={draft.statusLabel} onChange={v => set('statusLabel', v)} placeholder="Status label" />
                </div>
              </>
            ) : (
              <>
                <span className="action-card__date">{c.dateHeader}</span>
                <span className={`action-card__status ${STATUS_CLASS[c.statusType] ?? ''}`}>
                  <span>&#128308;</span> {c.statusLabel}
                </span>
              </>
            )}
          </div>

          <div className="action-card__body">
            {editing ? (
              <EditTextarea value={draft.message} onChange={v => set('message', v)} placeholder="Main message" />
            ) : (
              <p className="action-card__message">{c.message}</p>
            )}

            <div className="action-card__highlight">
              {editing ? (
                <EditTextarea value={draft.highlight} onChange={v => set('highlight', v)} placeholder="Highlight text (without trophy emoji)" />
              ) : (
                <p>&#127942; {c.highlight}</p>
              )}
            </div>

            <div className="action-card__bankroll">
              {editing ? (
                <EditInput value={draft.bankroll} onChange={v => set('bankroll', v)} placeholder="Bankroll line" />
              ) : (
                <p>{c.bankroll}</p>
              )}
            </div>

            {!editing && (
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
            )}
          </div>
        </div>
      </div>
    </section>

    {/* Fixed FAB — only visible to admin */}
    {isAdmin && (
      <div style={{ position: 'fixed', bottom: '28px', right: '28px', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        {editing ? (
          <>
            {/* Save */}
            <button
              onClick={saveEdit}
              disabled={saving}
              title="Save changes"
              style={{ ...fabStyle, background: 'var(--accent-green)', color: '#000' }}
            >
              {saving ? '…' : '✓'}
            </button>
            {/* Cancel */}
            <button
              onClick={cancelEdit}
              disabled={saving}
              title="Cancel"
              style={{ ...fabStyle, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '2px solid var(--border)', width: '40px', height: '40px', fontSize: '1rem' }}
            >
              ✕
            </button>
          </>
        ) : (
          <button
            onClick={startEdit}
            title="Edit Today's Action"
            style={{ ...fabStyle, background: 'var(--accent-green)', color: '#000' }}
          >
            ✏
          </button>
        )}
        {error && editing && (
          <span style={{ background: 'rgba(239,68,68,0.9)', color: '#fff', fontSize: '0.72rem', padding: '4px 8px', borderRadius: '6px', maxWidth: '140px', textAlign: 'center' }}>
            {error}
          </span>
        )}
      </div>
    )}
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const fabStyle: React.CSSProperties = {
  width: '54px',
  height: '54px',
  borderRadius: '50%',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.3rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  transition: 'transform 0.15s, box-shadow 0.15s',
}

// ── Inline edit primitives ────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px dashed rgba(52,211,153,0.5)',
  borderRadius: '4px',
  padding: '4px 8px',
  color: 'inherit',
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-secondary)',
  border: '1px dashed rgba(52,211,153,0.5)',
  borderRadius: '4px',
  padding: '4px 8px',
  color: 'var(--text-secondary)',
  fontFamily: 'inherit',
  fontSize: '0.8rem',
}

function EditInput({
  value,
  onChange,
  placeholder,
  small,
  heading,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  small?: boolean
  heading?: boolean
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...inputBase,
        fontSize: heading ? '1.6rem' : small ? '0.75rem' : '1rem',
        fontWeight: heading ? 700 : small ? 600 : 400,
        marginBottom: '6px',
        display: 'block',
      }}
    />
  )
}

function EditTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      style={{
        ...inputBase,
        resize: 'vertical',
        lineHeight: '1.6',
        marginBottom: '8px',
        display: 'block',
      }}
    />
  )
}
