'use client'

import { useState, useRef, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export interface TodaysBet {
  id: string
  date: string | null
  sport: string | null
  risk: string | null
  bet: string | null
  line: string | null
  win: string | null
  result: string | null
  note: string | null
  is_active: boolean
  is_free: boolean
  show_on_results: boolean
  created_at: string
}

interface Props {
  rows: TodaysBet[]
  isAdmin: boolean
  userTier: string | null  // null = logged out
  editMode?: boolean
}

const RESULT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  win:     { bg: 'rgba(52,211,153,0.15)',  color: '#34d399', label: 'Win' },
  loss:    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171', label: 'Loss' },
  push:    { bg: 'rgba(234,179,8,0.15)',   color: '#facc15', label: 'Push' },
  pending: { bg: 'rgba(161,161,170,0.08)', color: 'var(--text-muted)', label: 'Pending' },
}

const EMPTY_FORM = {
  date: '', sport: '', risk: '', bet: '', line: '', win: '', result: 'pending', note: '',
  is_active: true, is_free: true, show_on_results: false,
}

export default function TodaysBets({ rows, isAdmin, userTier, editMode = false }: Props) {
  const router = useRouter()
  const [formMode, setFormMode]   = useState<'hidden' | 'add' | 'edit'>('hidden')
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const inlineFormRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (formMode === 'edit' && editId && inlineFormRef.current) {
      setTimeout(() => inlineFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    }
  }, [formMode, editId])

  useEffect(() => {
    if (!editMode) cancelForm()
  }, [editMode])

  function openAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setFormMode('add')
    setError(null)
  }

  function openEdit(row: TodaysBet) {
    setForm({
      date:            row.date   ?? '',
      sport:           row.sport  ?? '',
      risk:            row.risk   ?? '',
      bet:             row.bet    ?? '',
      line:            row.line   ?? '',
      win:             row.win    ?? '',
      result:          row.result ?? 'pending',
      note:            row.note   ?? '',
      is_active:       row.is_active,
      is_free:         row.is_free,
      show_on_results: row.show_on_results,
    })
    setEditId(row.id)
    setFormMode('edit')
    setError(null)
  }

  function cancelForm() {
    setFormMode('hidden')
    setEditId(null)
    setError(null)
  }

  function setField(name: string, value: string | boolean) {
    setForm(f => ({ ...f, [name]: value }))
  }

  async function saveRow() {
    setSaving(true)
    setError(null)
    try {
      const isEdit = formMode === 'edit' && editId
      const url    = isEdit ? `/api/admin/todays-bets/${editId}` : '/api/admin/todays-bets'
      const method = isEdit ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.error ?? 'Save failed')
      }
      cancelForm()
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteRow(id: string) {
    if (!confirm('Delete this bet?')) return
    const res = await fetch(`/api/admin/todays-bets/${id}`, { method: 'DELETE' })
    if (res.ok) { cancelForm(); router.refresh() }
  }

  const isLoggedOut = userTier === null
  const isPaid      = userTier === 'basic' || userTier === 'premium'

  function groupOrder(note: string | null) {
    if (note === 'Live')   return 0
    if (note === 'Future') return 1
    return 2
  }

  const sortedRows = [...rows].sort((a, b) => groupOrder(a.note) - groupOrder(b.note))
  const rs = (result: string | null) => RESULT_STYLE[result ?? 'pending'] ?? RESULT_STYLE.pending

  // Placeholder rows shown behind the gate when logged out and no real rows exist
  const PLACEHOLDER_ROWS = [
    { id: 'ph1', date: 'Today', sport: 'NFL',  risk: '$100', bet: '████████ -3.5',  line: '-110', win: '$90',  result: 'pending', note: '—' },
    { id: 'ph2', date: 'Today', sport: 'NBA',  risk: '$150', bet: '████████ +5.5',  line: '+105', win: '$157', result: 'win',     note: '—' },
    { id: 'ph3', date: 'Today', sport: 'CFB',  risk: '$200', bet: '████████ O 48.5', line: '-115', win: '$174', result: 'pending', note: '—' },
  ]
  const displayRows = isLoggedOut && rows.length === 0 ? PLACEHOLDER_ROWS : sortedRows

  return (
    <section id="todays-action" className="section todays-action">
      <div className="container">
        <div className="reveal">
          <span className="section-label">Daily Picks</span>
          <h2 className="section-title">What I'm Betting Today</h2>
          <p className="section-subtitle">My active plays — updated daily.</p>
        </div>

        {/* Add row button (shown when FAB edit mode is active) */}
        {isAdmin && editMode && (
          <div style={{ margin: '28px 0 16px' }}>
            <button className="btn btn--primary btn--sm" onClick={openAdd}>
              + Add Row
            </button>
          </div>
        )}

        {/* Add form */}
        {isAdmin && editMode && formMode === 'add' && (
          <BetForm
            form={form}
            setField={setField}
            onSave={saveRow}
            onCancel={cancelForm}
            saving={saving}
            error={error}
          />
        )}

        {/* Logged-in, no rows yet */}
        {!isLoggedOut && rows.length === 0 && !isAdmin && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '2.5rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            marginTop: '28px',
          }}>
            No picks posted yet — check back soon.
          </div>
        )}

        {/* Table — always rendered when there are rows (or placeholders for gate) */}
        {(rows.length > 0 || isLoggedOut) && (
          <div className="content-gate-wrap" style={{ marginTop: '28px' }}>
            <div className={isLoggedOut ? 'content-gate-blurred' : ''} style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Date', 'Sport', 'Risk', 'Bet', 'Line', 'Win', 'Result', 'Note'].map(col => (
                      <th key={col} style={thStyle}>{col}</th>
                    ))}
                    {isAdmin && editMode && <th style={thStyle} />}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row: any) => {
                    const locked = !isAdmin && !isPaid && !row.is_free
                    if (locked) {
                      return (
                        <Fragment key={row.id}>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <td colSpan={8} style={{ padding: '14px 12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontSize: '1rem' }}>🔒</span>
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Members Only</span>
                                <Link href="/pricing" className="btn btn--primary btn--sm">Upgrade to Unlock</Link>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      )
                    }
                    return (
                      <Fragment key={row.id}>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span>{row.date ?? '—'}</span>
                              {!isLoggedOut && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {row.is_active && (
                                    <span style={tagStyle('var(--accent-green)', 'rgba(52,211,153,0.12)')}>Active</span>
                                  )}
                                  {!row.is_free && (
                                    <span style={tagStyle('var(--accent-purple)', 'rgba(129,140,248,0.12)')}>Members</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--accent-cyan)', fontWeight: 600 }}>{row.sport ?? '—'}</td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{row.risk ?? '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, maxWidth: '200px' }}>{row.bet ?? '—'}</td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{row.line ?? '—'}</td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>{row.win ?? '—'}</td>
                          <td style={tdStyle}>
                            <span style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              background: rs(row.result).bg,
                              color: rs(row.result).color,
                            }}>
                              {rs(row.result).label}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.note ?? '—'}</td>
                          {isAdmin && editMode && (
                            <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                              <button
                                className="admin-action-btn"
                                onClick={() => editId === row.id && formMode === 'edit' ? cancelForm() : openEdit(row)}
                              >
                                Edit
                              </button>
                              <button
                                className="admin-action-btn"
                                style={{ marginLeft: '6px', color: '#f87171' }}
                                onClick={() => deleteRow(row.id)}
                              >
                                ✕
                              </button>
                            </td>
                          )}
                        </tr>

                        {/* Inline edit form */}
                        {isAdmin && editMode && formMode === 'edit' && editId === row.id && (
                          <tr>
                            <td colSpan={9} style={{ padding: 0 }}>
                              <div ref={inlineFormRef}>
                                <BetForm
                                  form={form}
                                  setField={setField}
                                  onSave={saveRow}
                                  onCancel={cancelForm}
                                  saving={saving}
                                  error={error}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Logged-out gate overlay */}
            {isLoggedOut && (
              <div className="content-gate-overlay">
                <div className="content-gate-card" style={{ maxWidth: '320px', padding: '24px 24px' }}>
                  <div className="content-gate-card__icon" style={{ fontSize: '1.5rem', marginBottom: '10px' }}>🔒</div>
                  <h3 className="content-gate-card__title" style={{ fontSize: '1rem', marginBottom: '6px' }}>Sign in to view today's picks</h3>
                  <p className="content-gate-card__desc" style={{ fontSize: '0.82rem', marginBottom: '16px' }}>
                    Free members see free-tagged picks. Subscribe for full access.
                  </p>
                  <div className="content-gate-card__actions">
                    <Link href="/login" className="btn btn--primary btn--sm">Sign In</Link>
                    <Link href="/signup" className="btn btn--outline btn--sm">Create Free Account</Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: '32px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <a href="https://t.me/edthestatman" className="btn btn--primary btn--sm" target="_blank" rel="noopener">
            ⚡ Get Picks on Telegram
          </a>
          <a href="https://discord.gg/gqPrVBg4Aw" className="btn btn--secondary btn--sm" target="_blank" rel="noopener">
            💬 Join Discord
          </a>
          <Link href="/betting-systems" className="btn btn--outline btn--sm">
            📊 View All Systems
          </Link>
          <Link href="/betting-trends" className="btn btn--outline btn--sm">
            📈 View All Trends
          </Link>
        </div>
      </div>
    </section>
  )
}

// ── Inline edit/add form ──────────────────────────────────────────────────────

interface BetFormProps {
  form: typeof EMPTY_FORM
  setField: (name: string, value: string | boolean) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
}

function BetForm({ form, setField, onSave, onCancel, saving, error }: BetFormProps) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '20px',
      margin: '8px 0 12px',
    }}>
      {error && <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { name: 'date',  label: 'Date',  placeholder: 'Mar 18' },
          { name: 'sport', label: 'Sport', placeholder: 'NFL' },
          { name: 'risk',  label: 'Risk',  placeholder: '$100' },
          { name: 'bet',   label: 'Bet',   placeholder: 'Chiefs -3.5' },
          { name: 'line',  label: 'Line',  placeholder: '-110' },
          { name: 'win',   label: 'Win',   placeholder: '$90' },
        ].map(({ name, label, placeholder }) => (
          <div key={name}>
            <label style={labelStyle}>{label}</label>
            <input
              value={form[name as keyof typeof form] as string}
              onChange={e => setField(name, e.target.value)}
              placeholder={placeholder}
              style={inputStyle}
            />
          </div>
        ))}

        <div>
          <label style={labelStyle}>Result</label>
          <select value={form.result} onChange={e => setField('result', e.target.value)} style={inputStyle}>
            <option value="pending">Pending</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="push">Push</option>
          </select>
        </div>

        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>Note</label>
          <input
            value={form.note}
            onChange={e => setField('note', e.target.value)}
            placeholder="Optional note…"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Toggles row */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
        <ToggleBtn
          label="Active"
          active={form.is_active}
          onColor="var(--accent-green)"
          onClick={() => setField('is_active', !form.is_active)}
        />
        <ToggleBtn
          label={form.is_free ? 'Free' : 'Members Only'}
          active={!form.is_free}
          onColor="var(--accent-purple)"
          onClick={() => setField('is_free', !form.is_free)}
        />
        <ToggleBtn
          label="Show on Results"
          active={form.show_on_results}
          onColor="var(--accent-cyan)"
          onClick={() => setField('show_on_results', !form.show_on_results)}
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button className="btn btn--primary btn--sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn--outline btn--sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ToggleBtn({ label, active, onColor, onClick }: {
  label: string; active: boolean; onColor: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 14px',
        borderRadius: '20px',
        fontSize: '0.78rem',
        fontWeight: 700,
        cursor: 'pointer',
        border: active ? `1px solid ${onColor}` : '1px solid var(--border)',
        background: active ? `color-mix(in srgb, ${onColor} 15%, transparent)` : 'transparent',
        color: active ? onColor : 'var(--text-muted)',
        transition: 'all 0.15s',
      }}
    >
      {active ? '● ' : '○ '}{label}
    </button>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
}

const tdStyle: React.CSSProperties = {
  padding: '14px 12px',
  fontSize: '0.9rem',
  verticalAlign: 'middle',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
  marginBottom: '5px',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

function tagStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '1px 7px',
    borderRadius: '20px',
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    background: bg,
    color,
    border: `1px solid ${color}40`,
  }
}
