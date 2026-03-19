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
  created_at: string
}

interface Props {
  rows: TodaysBet[]
  isAdmin: boolean
}

const RESULT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  win:     { bg: 'rgba(52,211,153,0.15)',  color: '#34d399', label: 'Win' },
  loss:    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171', label: 'Loss' },
  push:    { bg: 'rgba(234,179,8,0.15)',   color: '#facc15', label: 'Push' },
  pending: { bg: 'rgba(161,161,170,0.08)', color: 'var(--text-muted)', label: 'Pending' },
}

const EMPTY: Record<string, string> = {
  date: '', sport: '', risk: '', bet: '', line: '', win: '', result: 'pending', note: '',
}

export default function TodaysBets({ rows, isAdmin }: Props) {
  const router = useRouter()
  const [editMode, setEditMode]   = useState(false)
  const [formMode, setFormMode]   = useState<'hidden' | 'add' | 'edit'>('hidden')
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState(EMPTY)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const inlineFormRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (formMode === 'edit' && editId && inlineFormRef.current) {
      setTimeout(() => inlineFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    }
  }, [formMode, editId])

  function openAdd() {
    setForm(EMPTY)
    setEditId(null)
    setFormMode('add')
    setError(null)
  }

  function openEdit(row: TodaysBet) {
    setForm({
      date:   row.date   ?? '',
      sport:  row.sport  ?? '',
      risk:   row.risk   ?? '',
      bet:    row.bet    ?? '',
      line:   row.line   ?? '',
      win:    row.win    ?? '',
      result: row.result ?? 'pending',
      note:   row.note   ?? '',
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

  function field(name: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [name]: e.target.value }))
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
    if (res.ok) {
      cancelForm()
      router.refresh()
    }
  }

  const resultStyle = (result: string | null) =>
    RESULT_STYLE[result ?? 'pending'] ?? RESULT_STYLE.pending

  return (
    <section id="todays-action" className="section todays-action">
      <div className="container">
        <div className="reveal">
          <span className="section-label">Daily Picks</span>
          <h2 className="section-title">What I'm Betting Today</h2>
          <p className="section-subtitle">My active plays — updated daily.</p>
        </div>

        {/* Admin toolbar */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: '10px', margin: '28px 0 16px', flexWrap: 'wrap' }}>
            <button
              className={`admin-filter-btn ${editMode ? 'admin-filter-btn--active' : ''}`}
              onClick={() => { setEditMode(e => !e); cancelForm() }}
            >
              {editMode ? 'Exit Edit' : '✏ Edit Mode'}
            </button>
            {editMode && (
              <button className="btn btn--primary btn--sm" onClick={openAdd}>
                + Add Row
              </button>
            )}
          </div>
        )}

        {/* Add form */}
        {isAdmin && editMode && formMode === 'add' && (
          <BetForm
            form={form}
            field={field}
            onSave={saveRow}
            onCancel={cancelForm}
            saving={saving}
            error={error}
          />
        )}

        {rows.length === 0 && !isAdmin && (
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

        {rows.length > 0 && (
          <div style={{ marginTop: '28px', overflowX: 'auto' }}>
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
                {rows.map(row => {
                  const rs = resultStyle(row.result)
                  return (
                    <Fragment key={row.id}>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={tdStyle}>{row.date ?? '—'}</td>
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
                            background: rs.bg,
                            color: rs.color,
                          }}>
                            {rs.label}
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
                          <td colSpan={9} style={{ padding: '0' }}>
                            <div ref={inlineFormRef}>
                              <BetForm
                                form={form}
                                field={field}
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

// ── Shared inline form ────────────────────────────────────────────────────────

interface BetFormProps {
  form: Record<string, string>
  field: (name: string) => (e: React.ChangeEvent<any>) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  error: string | null
}

function BetForm({ form, field, onSave, onCancel, saving, error }: BetFormProps) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '20px',
      margin: '8px 0 12px',
    }}>
      {error && (
        <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>
      )}
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
              value={form[name]}
              onChange={field(name)}
              placeholder={placeholder}
              style={inputStyle}
            />
          </div>
        ))}

        <div>
          <label style={labelStyle}>Result</label>
          <select value={form.result} onChange={field('result')} style={inputStyle}>
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
            onChange={field('note')}
            placeholder="Optional note…"
            style={inputStyle}
          />
        </div>
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
}
