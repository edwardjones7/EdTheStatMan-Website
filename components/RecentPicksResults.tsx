'use client'

import { useState, useRef, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import type { TodaysBet } from './TodaysBets'

interface Props {
  rows: TodaysBet[]
  isAdmin?: boolean
  editMode?: boolean
}

const RESULT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  win:     { bg: 'rgba(52,211,153,0.15)',  color: '#34d399', label: 'Win' },
  loss:    { bg: 'rgba(239,68,68,0.15)',   color: '#f87171', label: 'Loss' },
  push:    { bg: 'rgba(234,179,8,0.15)',   color: '#facc15', label: 'Push' },
  pending: { bg: 'rgba(161,161,170,0.08)', color: '#a1a1aa', label: 'Pending' },
}

const EMPTY_FORM = {
  date: '', sport: '', risk: '', bet: '', line: '', win: '', result: 'pending', note: '',
  is_active: true, is_free: true, show_on_results: true,
}

export default function RecentPicksResults({ rows, isAdmin = false, editMode = false }: Props) {
  const router = useRouter()
  const [formMode, setFormMode] = useState<'hidden' | 'add' | 'edit'>('hidden')
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState(EMPTY_FORM)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)
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
    if (!confirm('Delete this pick?')) return
    const res = await fetch(`/api/admin/todays-bets/${id}`, { method: 'DELETE' })
    if (res.ok) { cancelForm(); router.refresh() }
  }

  if (rows.length === 0 && !isAdmin) return null

  return (
    <section className="section">
      <div className="container">
        <div className="reveal">
          <span className="section-label">Past Picks</span>
          <h2 className="section-title">Pick Results</h2>
          <p className="section-subtitle">Logged results from recent daily picks.</p>
        </div>

        {isAdmin && editMode && (
          <div style={{ margin: '28px 0 16px' }}>
            <button className="btn btn--primary btn--sm" onClick={openAdd}>
              + Add Row
            </button>
          </div>
        )}

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

        {rows.length === 0 && isAdmin && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '2.5rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            marginTop: '28px',
          }}>
            No picks toggled to results yet.
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ marginTop: '32px', overflowX: 'auto' }}>
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
                  const rs = RESULT_STYLE[row.result ?? 'pending'] ?? RESULT_STYLE.pending
                  return (
                    <Fragment key={row.id}>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={tdStyle}>{row.date ?? '—'}</td>
                        <td style={{ ...tdStyle, color: 'var(--accent-cyan)', fontWeight: 600 }}>{row.sport ?? '—'}</td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{row.risk ?? '—'}</td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{row.bet ?? '—'}</td>
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
        )}
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

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
        <ToggleBtn label="Active"          active={form.is_active}       onColor="var(--accent-green)"  onClick={() => setField('is_active', !form.is_active)} />
        <ToggleBtn label={form.is_free ? 'Free' : 'Members Only'} active={!form.is_free} onColor="var(--accent-purple)" onClick={() => setField('is_free', !form.is_free)} />
        <ToggleBtn label="Show on Results" active={form.show_on_results} onColor="var(--accent-cyan)"   onClick={() => setField('show_on_results', !form.show_on_results)} />
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
