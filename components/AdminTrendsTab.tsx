'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface BettingTrend {
  id: string
  sport: string
  description: string
  line: string
  season: string
  pct: number | null
  units: number | null
  type: string
  w: number
  l: number
  t: number
  date: string
  team: string
  is_free: boolean
  is_active: boolean
  sort_order: number
}

const SPORTS = ['nba', 'cbb', 'nfl', 'cfb'] as const
const SPORT_LABELS: Record<string, string> = { nba: 'NBA', cbb: 'CBB', nfl: 'NFL', cfb: 'CFB' }

const BLANK = {
  sport: 'cbb',
  description: '',
  line: '',
  season: '',
  pct: '' as number | null | string,
  units: '' as number | null | string,
  type: '',
  w: 0,
  l: 0,
  t: 0,
  is_free: false,
  is_active: true,
  sort_order: 0,
}

export default function AdminTrendsTab({ trends }: { trends: BettingTrend[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<'hidden' | 'add' | 'edit'>('hidden')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sportFilter, setSportFilter] = useState('all')

  function openAdd() {
    setForm({ ...BLANK })
    setEditId(null)
    setMode('add')
    setError(null)
  }

  function openEdit(t: BettingTrend) {
    setForm({
      sport: t.sport,
      description: t.description,
      line: t.line,
      season: t.season,
      pct: t.pct,
      units: t.units,
      type: t.type,
      w: t.w,
      l: t.l,
      t: t.t,
      is_free: t.is_free,
      is_active: t.is_active,
      sort_order: t.sort_order,
    })
    setEditId(t.id)
    setMode('edit')
    setError(null)
  }

  function cancel() { setMode('hidden'); setEditId(null); setError(null) }
  function set(field: string, value: unknown) { setForm(f => ({ ...f, [field]: value })) }

  async function save() {
    if (!form.description.trim()) { setError('Description is required.'); return }
    setSaving(true)
    setError(null)

    const payload = {
      ...form,
      pct: form.pct === '' || form.pct === null ? null : Number(form.pct),
      units: form.units === '' || form.units === null ? null : Number(form.units),
    }

    const res = await fetch(
      mode === 'edit' ? `/api/admin/trends/${editId}` : '/api/admin/trends',
      {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
    cancel()
    router.refresh()
  }

  async function toggleActive(t: BettingTrend) {
    setToggling(t.id)
    await fetch(`/api/admin/trends/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !t.is_active }),
    })
    setToggling(null)
    router.refresh()
  }

  async function del(id: string, description: string) {
    if (!confirm(`Delete "${description}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/trends/${id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Delete failed.'); return }
    router.refresh()
  }

  const filtered = sportFilter === 'all' ? trends : trends.filter(t => t.sport === sportFilter)

  return (
    <div className="admin-section">
      <div className="admin-section__toolbar">
        <div className="admin-filters">
          {['all', ...SPORTS].map(s => (
            <button
              key={s}
              className={`admin-filter-btn ${sportFilter === s ? 'admin-filter-btn--active' : ''}`}
              onClick={() => setSportFilter(s)}
            >
              {s === 'all' ? 'All' : SPORT_LABELS[s]}
            </button>
          ))}
        </div>
        <button className="btn btn--primary btn--sm" onClick={openAdd} disabled={mode !== 'hidden'}>
          + Add Trend
        </button>
      </div>
      <span className="admin-count">{filtered.length} trend{filtered.length !== 1 ? 's' : ''}</span>

      {/* Form */}
      {mode !== 'hidden' && (
        <div className="admin-inline-form">
          <div className="admin-inline-form__title">{mode === 'add' ? 'New Betting Trend' : 'Edit Betting Trend'}</div>
          {error && <div className="admin-inline-form__error">{error}</div>}

          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label className="admin-form-label">Sport</label>
              <select className="admin-form-select" value={form.sport} onChange={e => set('sport', e.target.value)}>
                {SPORTS.map(s => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
              </select>
            </div>

            <div className="admin-form-field admin-form-field--wide">
              <label className="admin-form-label">Description / Rule</label>
              <textarea className="admin-form-input" rows={2} value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Teams off 2+ days rest vs teams on back-to-back" />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Line</label>
              <input className="admin-form-input" value={form.line} onChange={e => set('line', e.target.value)} placeholder="e.g. ATS, O/U, ML" />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Season</label>
              <input className="admin-form-input" value={form.season} onChange={e => set('season', e.target.value)} placeholder="e.g. 2023-24" />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Type</label>
              <input className="admin-form-input" value={form.type} onChange={e => set('type', e.target.value)} placeholder="e.g. Situational, Trend" />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">W</label>
              <input className="admin-form-input" type="number" min={0} value={form.w} onChange={e => set('w', +e.target.value)} />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">L</label>
              <input className="admin-form-input" type="number" min={0} value={form.l} onChange={e => set('l', +e.target.value)} />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">T</label>
              <input className="admin-form-input" type="number" min={0} value={form.t} onChange={e => set('t', +e.target.value)} />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Pct (e.g. 0.65)</label>
              <input className="admin-form-input" type="number" step="0.01" min={0} max={1} value={form.pct ?? ''} onChange={e => set('pct', e.target.value)} placeholder="0.65" />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Units</label>
              <input className="admin-form-input" type="number" step="0.1" value={form.units ?? ''} onChange={e => set('units', e.target.value)} placeholder="12.5" />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Sort Order</label>
              <input className="admin-form-input" type="number" value={form.sort_order} onChange={e => set('sort_order', +e.target.value)} />
            </div>

            <div className="admin-form-field admin-form-field--checks">
              <label className="admin-form-check">
                <input type="checkbox" checked={form.is_free} onChange={e => set('is_free', e.target.checked)} />
                <span>Free tier access</span>
              </label>
              <label className="admin-form-check">
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
                <span>Active (visible on public page)</span>
              </label>
            </div>
          </div>

          <div className="admin-inline-form__actions">
            <button className="btn btn--primary btn--sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn--outline btn--sm" onClick={cancel} disabled={saving}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="admin-empty-state">
          <p>{trends.length === 0 ? 'No trends yet. Add your first one above.' : 'No trends in this sport.'}</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Sport</th>
                <th>W-L-T</th>
                <th>Pct</th>
                <th>Type</th>
                <th>Access</th>
                <th>Visible</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} style={!t.is_active ? { opacity: 0.5 } : undefined}>
                  <td>
                    <div className="admin-post-title" style={{ maxWidth: '320px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.description || <em className="admin-muted">—</em>}
                    </div>
                  </td>
                  <td><span className="admin-tag">{SPORT_LABELS[t.sport] ?? t.sport}</span></td>
                  <td className="admin-muted">{t.w}-{t.l}-{t.t}</td>
                  <td className="admin-muted">{t.pct !== null && t.pct !== undefined ? `${Math.round(t.pct * 100)}%` : '—'}</td>
                  <td className="admin-muted">{t.type || '—'}</td>
                  <td>
                    <span className={`admin-badge ${t.is_free ? 'admin-badge--blue' : 'admin-badge--purple'}`}>
                      {t.is_free ? 'Free' : 'Members'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`admin-badge ${t.is_active ? 'admin-badge--green' : 'admin-badge--muted'}`}
                      style={{ cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
                      onClick={() => toggleActive(t)}
                      disabled={toggling === t.id}
                      title={t.is_active ? 'Click to deactivate' : 'Click to activate'}
                    >
                      {toggling === t.id ? '…' : t.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button className="admin-action-btn" onClick={() => openEdit(t)}>Edit</button>
                      <button className="admin-action-btn admin-action-btn--danger" onClick={() => del(t.id, t.description)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
