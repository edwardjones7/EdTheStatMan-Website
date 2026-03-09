'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface BettingSystem {
  id: string
  sport: string
  name: string
  record_wins: number
  record_losses: number
  streak: string
  status: string
  status_active: boolean
  is_free: boolean
  sort_order: number
}

const SPORTS = ['nba', 'cbb', 'nfl', 'cfb'] as const
const SPORT_LABELS: Record<string, string> = { nba: 'NBA', cbb: 'CBB', nfl: 'NFL', cfb: 'CFB' }

const BLANK = {
  sport: 'nba',
  name: '',
  record_wins: 0,
  record_losses: 0,
  streak: '—',
  status: 'Active',
  status_active: true,
  is_free: false,
  sort_order: 0,
}

export default function AdminSystemsTab({ systems }: { systems: BettingSystem[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<'hidden' | 'add' | 'edit'>('hidden')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setForm({ ...BLANK })
    setEditId(null)
    setMode('add')
    setError(null)
  }

  function openEdit(s: BettingSystem) {
    setForm({
      sport: s.sport,
      name: s.name,
      record_wins: s.record_wins,
      record_losses: s.record_losses,
      streak: s.streak,
      status: s.status,
      status_active: s.status_active,
      is_free: s.is_free,
      sort_order: s.sort_order,
    })
    setEditId(s.id)
    setMode('edit')
    setError(null)
  }

  function cancel() {
    setMode('hidden')
    setEditId(null)
    setError(null)
  }

  function set(field: string, value: unknown) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function save() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true)
    setError(null)

    const res = await fetch(
      mode === 'edit' ? `/api/admin/systems/${editId}` : '/api/admin/systems',
      {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      }
    )
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong.'); return }
    cancel()
    router.refresh()
  }

  async function del(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/systems/${id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Delete failed.'); return }
    router.refresh()
  }

  return (
    <div className="admin-section">
      <div className="admin-section__toolbar">
        <span className="admin-count">{systems.length} betting system{systems.length !== 1 ? 's' : ''}</span>
        <button className="btn btn--primary btn--sm" onClick={openAdd} disabled={mode !== 'hidden'}>
          + Add System
        </button>
      </div>

      {/* Form */}
      {mode !== 'hidden' && (
        <div className="admin-inline-form">
          <div className="admin-inline-form__title">{mode === 'add' ? 'New Betting System' : 'Edit Betting System'}</div>
          {error && <div className="admin-inline-form__error">{error}</div>}

          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label className="admin-form-label">Sport</label>
              <select className="admin-form-select" value={form.sport} onChange={e => set('sport', e.target.value)}>
                {SPORTS.map(s => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
              </select>
            </div>

            <div className="admin-form-field admin-form-field--wide">
              <label className="admin-form-label">System Name</label>
              <input className="admin-form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. NBA Betting Systems" />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Record (W)</label>
              <input className="admin-form-input" type="number" min={0} value={form.record_wins} onChange={e => set('record_wins', +e.target.value)} />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Record (L)</label>
              <input className="admin-form-input" type="number" min={0} value={form.record_losses} onChange={e => set('record_losses', +e.target.value)} />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Streak</label>
              <input className="admin-form-input" value={form.streak} onChange={e => set('streak', e.target.value)} placeholder="W2 / L1 / —" />
            </div>

            <div className="admin-form-field admin-form-field--wide">
              <label className="admin-form-label">Status Text</label>
              <input className="admin-form-input" value={form.status} onChange={e => set('status', e.target.value)} placeholder="Active — Daily Posts" />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Sort Order</label>
              <input className="admin-form-input" type="number" value={form.sort_order} onChange={e => set('sort_order', +e.target.value)} />
            </div>

            <div className="admin-form-field admin-form-field--checks">
              <label className="admin-form-check">
                <input type="checkbox" checked={form.status_active} onChange={e => set('status_active', e.target.checked)} />
                <span>Active status (green dot)</span>
              </label>
              <label className="admin-form-check">
                <input type="checkbox" checked={form.is_free} onChange={e => set('is_free', e.target.checked)} />
                <span>Free tier access</span>
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
      {systems.length === 0 ? (
        <div className="admin-empty-state">
          <p>No betting systems yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Sport</th>
                <th>Record</th>
                <th>Streak</th>
                <th>Status</th>
                <th>Free</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {systems.map(s => (
                <tr key={s.id}>
                  <td><div className="admin-post-title">{s.name}</div></td>
                  <td><span className="admin-tag">{SPORT_LABELS[s.sport] ?? s.sport}</span></td>
                  <td className="admin-muted">{s.record_wins}-{s.record_losses}</td>
                  <td className="admin-muted">{s.streak}</td>
                  <td>
                    <span className={`admin-badge ${s.status_active ? 'admin-badge--green' : 'admin-badge--muted'}`}>
                      {s.status_active ? 'Active' : 'Ended'}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-badge ${s.is_free ? 'admin-badge--blue' : 'admin-badge--purple'}`}>
                      {s.is_free ? 'Free' : 'Members'}
                    </span>
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button className="admin-action-btn" onClick={() => openEdit(s)}>Edit</button>
                      <button className="admin-action-btn admin-action-btn--danger" onClick={() => del(s.id, s.name)}>Delete</button>
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
