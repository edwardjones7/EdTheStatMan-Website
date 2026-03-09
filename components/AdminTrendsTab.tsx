'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface BettingTrend {
  id: string
  sport: string
  team: string
  ats_wins: number
  ats_losses: number
  ou_wins: number
  ou_losses: number
  home_ats_wins: number
  home_ats_losses: number
  away_ats_wins: number
  away_ats_losses: number
  free_tags: Array<{ label: string; variant: 'win' | 'loss' | 'neutral' }>
  paid_tag: { label: string; variant: 'win' | 'loss' | 'neutral' } | null
  sort_order: number
}

const SPORTS = ['nba', 'cbb', 'nfl', 'cfb'] as const
const SPORT_LABELS: Record<string, string> = { nba: 'NBA', cbb: 'CBB', nfl: 'NFL', cfb: 'CFB' }
const VARIANTS = ['win', 'loss', 'neutral'] as const

type Tag = { label: string; variant: 'win' | 'loss' | 'neutral' }

const BLANK_TAG: Tag = { label: '', variant: 'win' }
const BLANK_FORM = {
  sport: 'nba',
  team: '',
  ats_wins: 0, ats_losses: 0,
  ou_wins: 0, ou_losses: 0,
  home_ats_wins: 0, home_ats_losses: 0,
  away_ats_wins: 0, away_ats_losses: 0,
  free_tags: [{ ...BLANK_TAG }, { ...BLANK_TAG }, { ...BLANK_TAG }] as Tag[],
  paid_tag: { ...BLANK_TAG } as Tag,
  sort_order: 0,
}

export default function AdminTrendsTab({ trends }: { trends: BettingTrend[] }) {
  const router = useRouter()
  const [mode, setMode] = useState<'hidden' | 'add' | 'edit'>('hidden')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...BLANK_FORM, free_tags: BLANK_FORM.free_tags.map(t => ({ ...t })), paid_tag: { ...BLANK_FORM.paid_tag } })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sportFilter, setSportFilter] = useState('all')

  function openAdd() {
    setForm({ ...BLANK_FORM, free_tags: BLANK_FORM.free_tags.map(t => ({ ...t })), paid_tag: { ...BLANK_FORM.paid_tag } })
    setEditId(null)
    setMode('add')
    setError(null)
  }

  function openEdit(t: BettingTrend) {
    const freeTags = [...t.free_tags]
    while (freeTags.length < 3) freeTags.push({ ...BLANK_TAG })
    setForm({
      sport: t.sport,
      team: t.team,
      ats_wins: t.ats_wins, ats_losses: t.ats_losses,
      ou_wins: t.ou_wins, ou_losses: t.ou_losses,
      home_ats_wins: t.home_ats_wins, home_ats_losses: t.home_ats_losses,
      away_ats_wins: t.away_ats_wins, away_ats_losses: t.away_ats_losses,
      free_tags: freeTags as Tag[],
      paid_tag: t.paid_tag ?? { ...BLANK_TAG },
      sort_order: t.sort_order,
    })
    setEditId(t.id)
    setMode('edit')
    setError(null)
  }

  function cancel() { setMode('hidden'); setEditId(null); setError(null) }
  function set(field: string, value: unknown) { setForm(f => ({ ...f, [field]: value })) }

  function setFreeTag(i: number, field: 'label' | 'variant', value: string) {
    setForm(f => {
      const tags = f.free_tags.map((t, idx) => idx === i ? { ...t, [field]: value } : t)
      return { ...f, free_tags: tags }
    })
  }

  function setPaidTag(field: 'label' | 'variant', value: string) {
    setForm(f => ({ ...f, paid_tag: { ...f.paid_tag, [field]: value } as Tag }))
  }

  async function save() {
    if (!form.team.trim()) { setError('Team name is required.'); return }
    setSaving(true)
    setError(null)

    const payload = {
      ...form,
      free_tags: form.free_tags.filter(t => t.label.trim()),
      paid_tag: form.paid_tag.label.trim() ? form.paid_tag : null,
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

  async function del(id: string, team: string) {
    if (!confirm(`Delete "${team}"? This cannot be undone.`)) return
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
      <p className="admin-count">{filtered.length} team{filtered.length !== 1 ? 's' : ''}</p>

      {/* Form */}
      {mode !== 'hidden' && (
        <div className="admin-inline-form">
          <div className="admin-inline-form__title">{mode === 'add' ? 'New Team Trend' : 'Edit Team Trend'}</div>
          {error && <div className="admin-inline-form__error">{error}</div>}

          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label className="admin-form-label">Sport</label>
              <select className="admin-form-select" value={form.sport} onChange={e => set('sport', e.target.value)}>
                {SPORTS.map(s => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
              </select>
            </div>

            <div className="admin-form-field admin-form-field--wide">
              <label className="admin-form-label">Team Name</label>
              <input className="admin-form-input" value={form.team} onChange={e => set('team', e.target.value)} placeholder="e.g. Boston Celtics" />
            </div>

            <div className="admin-form-field">
              <label className="admin-form-label">Sort Order</label>
              <input className="admin-form-input" type="number" value={form.sort_order} onChange={e => set('sort_order', +e.target.value)} />
            </div>
          </div>

          {/* Records */}
          <div className="admin-form-section-label">Records</div>
          <div className="admin-form-grid">
            {([
              ['ATS', 'ats_wins', 'ats_losses'],
              ['O/U', 'ou_wins', 'ou_losses'],
              ['Home ATS', 'home_ats_wins', 'home_ats_losses'],
              ['Away ATS', 'away_ats_wins', 'away_ats_losses'],
            ] as [string, keyof typeof form, keyof typeof form][]).map(([label, wKey, lKey]) => (
              <div key={label} className="admin-form-field">
                <label className="admin-form-label">{label}</label>
                <div className="admin-form-record">
                  <input className="admin-form-input" type="number" min={0} value={form[wKey] as number} onChange={e => set(wKey, +e.target.value)} placeholder="W" />
                  <span className="admin-form-record__sep">–</span>
                  <input className="admin-form-input" type="number" min={0} value={form[lKey] as number} onChange={e => set(lKey, +e.target.value)} placeholder="L" />
                </div>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div className="admin-form-section-label">Free Trend Tags (up to 3)</div>
          {form.free_tags.map((tag, i) => (
            <div key={i} className="admin-form-grid admin-form-tag-row">
              <div className="admin-form-field admin-form-field--wide">
                <label className="admin-form-label">Tag {i + 1} Label</label>
                <input
                  className="admin-form-input"
                  value={tag.label}
                  onChange={e => setFreeTag(i, 'label', e.target.value)}
                  placeholder="e.g. 8-2 ATS L10"
                />
              </div>
              <div className="admin-form-field">
                <label className="admin-form-label">Variant</label>
                <select className="admin-form-select" value={tag.variant} onChange={e => setFreeTag(i, 'variant', e.target.value)}>
                  {VARIANTS.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          ))}

          <div className="admin-form-section-label">Members-Only Tag</div>
          <div className="admin-form-grid admin-form-tag-row">
            <div className="admin-form-field admin-form-field--wide">
              <label className="admin-form-label">Paid Tag Label</label>
              <input
                className="admin-form-input"
                value={form.paid_tag.label}
                onChange={e => setPaidTag('label', e.target.value)}
                placeholder="e.g. 7-1 back-to-back"
              />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Variant</label>
              <select className="admin-form-select" value={form.paid_tag.variant} onChange={e => setPaidTag('variant', e.target.value)}>
                {VARIANTS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
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
          <p>{trends.length === 0 ? 'No trends yet. Add your first team above.' : 'No teams in this sport.'}</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Sport</th>
                <th>ATS</th>
                <th>O/U</th>
                <th>Home</th>
                <th>Away</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td><div className="admin-post-title">{t.team}</div></td>
                  <td><span className="admin-tag">{SPORT_LABELS[t.sport] ?? t.sport}</span></td>
                  <td className="admin-muted">{t.ats_wins}-{t.ats_losses}</td>
                  <td className="admin-muted">{t.ou_wins}-{t.ou_losses}</td>
                  <td className="admin-muted">{t.home_ats_wins}-{t.home_ats_losses}</td>
                  <td className="admin-muted">{t.away_ats_wins}-{t.away_ats_losses}</td>
                  <td className="admin-muted">{t.free_tags.length} free{t.paid_tag ? ' + 1 paid' : ''}</td>
                  <td>
                    <div className="admin-actions">
                      <button className="admin-action-btn" onClick={() => openEdit(t)}>Edit</button>
                      <button className="admin-action-btn admin-action-btn--danger" onClick={() => del(t.id, t.team)}>Delete</button>
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
