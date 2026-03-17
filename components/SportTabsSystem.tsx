'use client'

import { useState, useRef, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { BettingSystem } from './AdminSystemsTab'

type Sport = 'all' | 'nfl' | 'cfb' | 'nba' | 'cbb'

interface Props {
  systems: BettingSystem[]
  userTier: string | null
  isAdmin?: boolean
}

const TABS: { label: string; value: Sport }[] = [
  { label: 'All Sports', value: 'all' },
  { label: 'NFL', value: 'nfl' },
  { label: 'College Football', value: 'cfb' },
  { label: 'NBA', value: 'nba' },
  { label: 'College Basketball', value: 'cbb' },
]

const SPORT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  nba: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-gold)', label: 'NBA' },
  cbb: { bg: 'rgba(52, 211, 153, 0.1)', color: 'var(--accent-cyan)', label: 'CBB' },
  nfl: { bg: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', label: 'NFL' },
  cfb: { bg: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-purple)', label: 'CFB' },
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
  date: '',
  team: '',
  is_free: false,
  is_active: true,
}

interface XlsxSheet {
  name: string
  rows: Record<string, unknown>[]
  sport: string
  is_free: boolean
}

function pctDisplay(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '—'
  return `${Math.round(pct * 100)}%`
}

function parseNum(val: unknown): number | null {
  if (val === undefined || val === null || val === '') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

function parseIntVal(val: unknown): number {
  const n = parseNum(val)
  return n === null ? 0 : Math.round(n)
}

function parseStr(val: unknown): string {
  if (val === undefined || val === null) return ''
  return String(val).trim()
}

export default function SportTabsSystem({ systems, userTier, isAdmin = false }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Sport>('all')
  const [editMode, setEditMode] = useState(false)

  // Row form
  const [formMode, setFormMode] = useState<'hidden' | 'add' | 'edit'>('hidden')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // XLSX import
  const [importing, setImporting] = useState(false)
  const [xlsxSheets, setXlsxSheets] = useState<XlsxSheet[] | null>(null)
  const [clearBeforeImport, setClearBeforeImport] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const inlineFormRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (formMode === 'edit' && editId) {
      setTimeout(() => inlineFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    }
  }, [editId, formMode])

  const isPaid = userTier === 'basic' || userTier === 'premium'
  const isLoggedOut = userTier === null

  const allVisible = systems.filter(s => activeTab === 'all' || s.sport === activeTab)
  const baseRows = editMode ? allVisible : allVisible.filter(s => s.is_active)


  function openAdd() {
    setForm({ ...BLANK })
    setEditId(null)
    setFormMode('add')
    setFormError(null)
  }

  function openEdit(s: BettingSystem) {
    setForm({
      sport: s.sport,
      description: s.description,
      line: s.line,
      season: s.season,
      pct: s.pct,
      units: s.units,
      type: s.type,
      w: s.w,
      l: s.l,
      t: s.t,
      date: s.date ?? '',
      team: s.team ?? '',
      is_free: s.is_free,
      is_active: s.is_active,
    })
    setEditId(s.id)
    setFormMode('edit')
    setFormError(null)
  }

  function cancelForm() {
    setFormMode('hidden')
    setEditId(null)
    setFormError(null)
  }

  function setField(field: string, value: unknown) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function saveRow() {
    if (!form.description.trim()) { setFormError('Description is required.'); return }
    setSaving(true)
    setFormError(null)
    const payload = {
      ...form,
      pct: form.pct === '' || form.pct === null ? null : Number(form.pct),
      units: form.units === '' || form.units === null ? null : Number(form.units),
    }
    const res = await fetch(
      formMode === 'edit' ? `/api/admin/systems/${editId}` : '/api/admin/systems',
      {
        method: formMode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    )
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setFormError(data.error ?? 'Something went wrong.'); return }
    cancelForm()
    router.refresh()
  }

  async function deleteRow(id: string, description: string) {
    if (!confirm(`Delete "${description || '(blank row)'}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/systems/${id}`, { method: 'DELETE' })
    if (!res.ok) { alert('Delete failed.'); return }
    router.refresh()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError(null)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const sheets: XlsxSheet[] = wb.SheetNames.map(name => {
        const ws = wb.Sheets[name]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[]
        const lower = name.toLowerCase()
        const is_free = lower.includes('free')
        const sport = lower.includes('nfl') ? 'nfl'
          : lower.includes('nba') ? 'nba'
          : lower.includes('cfb') || lower.includes('college football') ? 'cfb'
          : 'cbb'
        return { name, rows, sport, is_free }
      })
      setXlsxSheets(sheets)
    } catch {
      setImportError('Failed to parse XLSX file.')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function runImport() {
    if (!xlsxSheets) return
    setImporting(true)
    setImportError(null)
    try {
      const records = xlsxSheets.flatMap((sheet, _i) =>
        sheet.rows
          .map((row, j) => ({
            sport: sheet.sport,
            description: parseStr(row['description'] ?? row['Description'] ?? row['DESCRIPTION'] ?? row['rule'] ?? row['Rule'] ?? ''),
            line: parseStr(row['line'] ?? row['Line'] ?? row['LINE'] ?? ''),
            season: parseStr(row['season'] ?? row['Season'] ?? row['SEASON'] ?? ''),
            pct: parseNum(row['pct'] ?? row['Pct'] ?? row['PCT'] ?? row['pct%'] ?? row['Pct%'] ?? ''),
            units: parseNum(row['units'] ?? row['Units'] ?? row['UNITS'] ?? ''),
            type: parseStr(row['type'] ?? row['Type'] ?? row['TYPE'] ?? ''),
            w: parseIntVal(row['w'] ?? row['W'] ?? row['wins'] ?? row['Wins'] ?? 0),
            l: parseIntVal(row['l'] ?? row['L'] ?? row['losses'] ?? row['Losses'] ?? 0),
            t: parseIntVal(row['t'] ?? row['T'] ?? row['ties'] ?? row['Ties'] ?? 0),
            is_free: sheet.is_free,
            is_active: true,
            sort_order: j,
          }))
          .filter(r => r.description !== '')
      )
      const res = await fetch('/api/admin/systems/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, clearFirst: clearBeforeImport }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed.')
      setXlsxSheets(null)
      setClearBeforeImport(false)
      router.refresh()
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setImporting(false)
    }
  }

  if (systems.length === 0 && !editMode) {
    return (
      <>
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          No betting systems available yet. Check back soon.
        </div>
        {isAdmin && (
          <div style={{ position: 'fixed', bottom: '28px', right: '28px', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setEditMode(true)}
              title="Edit systems"
              style={{ ...fabStyle, background: 'var(--accent-green)', color: '#000', border: 'none' }}
            >
              ✏
            </button>
          </div>
        )}
      </>
    )
  }

  // Stats bar computed values
  const memberCount = allVisible.filter(s => !s.is_free).length
  const freeCount = allVisible.filter(s => s.is_free).length
  const activeCount = allVisible.filter(s => s.is_active).length

  return (
    <>
      {/* Summary stats bar */}
      <div className="sys-stats-bar reveal" style={{ marginTop: '32px' }}>
        <div className="sys-stats-chip">
          <span className="sys-stats-chip__label">Member Systems</span>
          <span className="sys-stats-chip__value">{memberCount}</span>
        </div>
        <div className="sys-stats-chip">
          <span className="sys-stats-chip__label">Free Systems</span>
          <span className="sys-stats-chip__value">{freeCount}</span>
        </div>
        <div className="sys-stats-chip">
          <span className="sys-stats-chip__label">Active Systems</span>
          <span className="sys-stats-chip__value">{activeCount}</span>
        </div>
      </div>

      {/* Sport tabs */}
      <div className="sport-tabs reveal">
        {TABS.map(tab => (
          <button
            key={tab.value}
            className={`sport-tab${activeTab === tab.value ? ' active' : ''}`}
            onClick={() => { setActiveTab(tab.value); cancelForm() }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Admin toolbar */}
      {isAdmin && editMode && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
          <button
            className="btn btn--primary btn--sm"
            onClick={openAdd}
            disabled={formMode !== 'hidden'}
          >
            + Add Row
          </button>
          <button
            className="btn btn--outline btn--sm"
            onClick={() => fileRef.current?.click()}
            style={{ borderColor: 'rgba(52,211,153,0.4)', color: 'var(--accent-cyan)' }}
          >
            &#8679; Import XLSX
          </button>
          <button
            className="btn btn--outline btn--sm"
            onClick={async () => {
              if (!confirm('Delete ALL systems? This cannot be undone.')) return
              await fetch('/api/admin/systems/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ records: [], clearFirst: true }),
              })
              router.refresh()
            }}
            style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' }}
          >
            Clear All
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {allVisible.length} row{allVisible.length !== 1 ? 's' : ''} &middot; {allVisible.filter(s => s.is_active).length} active
          </span>
        </div>
      )}

      {/* XLSX import config panel */}
      {isAdmin && editMode && xlsxSheets && (
        <div style={{
          margin: '16px 0',
          padding: '20px',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
            Configure Import — {xlsxSheets.length} sheet{xlsxSheets.length !== 1 ? 's' : ''} found
          </div>
          {importError && (
            <div style={{ color: '#ef4444', marginBottom: '10px', fontSize: '0.85rem' }}>{importError}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            {xlsxSheets.map((sheet, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap',
                padding: '10px 14px',
                background: 'var(--bg-primary)',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', flex: '1 1 160px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{sheet.name}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '6px' }}>({sheet.rows.length} rows)</span>
                </span>
                <select
                  className="admin-form-select"
                  value={sheet.sport}
                  onChange={e => setXlsxSheets(prev => prev!.map((s, j) => j === i ? { ...s, sport: e.target.value } : s))}
                  style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                >
                  {SPORTS.map(s => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setXlsxSheets(prev => prev!.map((s, j) => j === i ? { ...s, is_free: !s.is_free } : s))}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: sheet.is_free ? 'rgba(56,189,248,0.15)' : 'rgba(124,58,237,0.15)',
                    color: sheet.is_free ? '#38bdf8' : 'var(--accent-purple)',
                  }}
                >
                  {sheet.is_free ? 'Free' : 'Members'}
                </button>
              </div>
            ))}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '14px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={clearBeforeImport} onChange={e => setClearBeforeImport(e.target.checked)} />
            Clear all existing systems before import
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn--primary btn--sm" onClick={runImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${xlsxSheets.reduce((a, s) => a + s.rows.length, 0)} rows`}
            </button>
            <button className="btn btn--outline btn--sm" onClick={() => { setXlsxSheets(null); setImportError(null) }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add form only at top */}
      {isAdmin && editMode && formMode === 'add' && (
        <div className="admin-inline-form" style={{ marginTop: '16px' }}>
          <div className="admin-inline-form__title">New Betting System</div>
          {formError && <div className="admin-inline-form__error">{formError}</div>}
          <div className="admin-form-grid">
            <div className="admin-form-field">
              <label className="admin-form-label">Sport</label>
              <select className="admin-form-select" value={form.sport} onChange={e => setField('sport', e.target.value)}>
                {SPORTS.map(s => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="admin-form-field admin-form-field--wide">
              <label className="admin-form-label">Description / Rule</label>
              <textarea className="admin-form-input" rows={2} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="e.g. Teams off 2+ days rest vs teams on back-to-back" />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Line</label>
              <input className="admin-form-input" value={form.line} onChange={e => setField('line', e.target.value)} placeholder="ATS, O/U, ML" />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Season</label>
              <input className="admin-form-input" value={form.season} onChange={e => setField('season', e.target.value)} placeholder="2023-24" />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Type</label>
              <input className="admin-form-input" value={form.type} onChange={e => setField('type', e.target.value)} placeholder="Situational, Trend" />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Date</label>
              <input className="admin-form-input" value={form.date} onChange={e => setField('date', e.target.value)} placeholder="e.g. 2024-01-15" />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Team</label>
              <input className="admin-form-input" value={form.team} onChange={e => setField('team', e.target.value)} placeholder="e.g. Lakers" />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">W</label>
              <input className="admin-form-input" type="number" min={0} value={form.w} onChange={e => setField('w', +e.target.value)} />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">L</label>
              <input className="admin-form-input" type="number" min={0} value={form.l} onChange={e => setField('l', +e.target.value)} />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">T</label>
              <input className="admin-form-input" type="number" min={0} value={form.t} onChange={e => setField('t', +e.target.value)} />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Pct (0.65 = 65%)</label>
              <input className="admin-form-input" type="number" step="0.01" min={0} max={1} value={form.pct ?? ''} onChange={e => setField('pct', e.target.value)} placeholder="0.65" />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Units</label>
              <input className="admin-form-input" type="number" step="0.1" value={form.units ?? ''} onChange={e => setField('units', e.target.value)} placeholder="12.5" />
            </div>
            <div className="admin-form-field admin-form-field--checks">
              <label className="admin-form-check">
                <input type="checkbox" checked={form.is_free} onChange={e => setField('is_free', e.target.checked)} />
                <span>Free tier access</span>
              </label>
              <label className="admin-form-check">
                <input type="checkbox" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} />
                <span>Active (visible on public page)</span>
              </label>
            </div>
          </div>
          <div className="admin-inline-form__actions">
            <button className="btn btn--primary btn--sm" onClick={saveRow} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="btn btn--outline btn--sm" onClick={cancelForm} disabled={saving}>Cancel</button>
          </div>
        </div>
      )}

      {/* Card grid */}
      <div className="content-gate-wrap" style={{ marginTop: '24px' }}>
        <div className={isLoggedOut ? 'content-gate-blurred' : ''}>
          {baseRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
              No systems in this sport.
            </div>
          ) : (
            <div className="sys-card-grid">
              {baseRows.map(row => {
                const locked = !isPaid && !row.is_free && !isAdmin
                const style = SPORT_STYLE[row.sport] ?? { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', label: row.sport.toUpperCase() }
                const winning = row.w > row.l
                const pctWidth = row.pct !== null ? Math.round(row.pct * 100) : 0

                if (locked) {
                  return (
                    <Fragment key={row.id}>
                      <div className="sys-row-card sys-row-card--locked">
                        <div className="sys-row-card__body" style={{ justifyContent: 'center', padding: '16px 24px', gap: '16px' }}>
                          <span style={{ fontSize: '1.1rem' }}>🔒</span>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Members Only</span>
                          <Link href="/betting-systems#pricing" className="btn btn--primary btn--sm">Upgrade to Unlock</Link>
                        </div>
                      </div>
                    </Fragment>
                  )
                }

                return (
                  <Fragment key={row.id}>
                    <div
                      className={[
                        'sys-row-card',
                        `sys-row-card--${row.sport}`,
                        !row.is_active && isAdmin && editMode ? 'sys-row-card--inactive' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      {/* Admin controls strip */}
                      {isAdmin && editMode && (
                        <div className="sys-row-card__admin">
                          <button
                            onClick={() => openEdit(row)}
                            style={{
                              padding: '3px 9px', borderRadius: '10px', border: '1px solid var(--border-color)',
                              cursor: 'pointer', fontSize: '0.7rem', background: 'transparent', color: 'var(--text-secondary)',
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteRow(row.id, row.description)}
                            style={{
                              padding: '3px 9px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                              fontSize: '0.7rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      )}

                      {/* Horizontal data row */}
                      <div className="sys-row-card__body">
                        {/* Sport badge */}
                        <div className="sys-row-card__sport-col">
                          <span className="sys-row-card__sport-badge">{style.label}</span>
                        </div>

                        {/* Description */}
                        <div className="sys-row-card__desc-col">
                          <div className="sys-row-card__desc">
                            {row.description || <em style={{ color: 'var(--text-muted)' }}>No description</em>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span className={`sys-row-card__access-badge sys-row-card__access-badge--${row.is_free ? 'free' : 'members'}`}>
                              {row.is_free ? 'Free' : 'Members'}
                            </span>
                            {isAdmin && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center',
                                padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.68rem', fontWeight: 600,
                                background: row.is_active ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
                                color: row.is_active ? 'var(--accent-green)' : '#ef4444',
                              }}>
                                {row.is_active ? 'Active' : 'Inactive'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Record */}
                        <div className="sys-row-card__field">
                          <span className="sys-row-card__field-label">Record</span>
                          {locked ? (
                            <span className="sys-row-card__lock">&#128274; <Link href="/betting-systems#pricing">Upgrade</Link></span>
                          ) : (
                            <span className={`sys-row-card__record sys-row-card__record--${winning ? 'win' : row.w < row.l ? 'loss' : 'neutral'}`}>
                              {row.w}-{row.l}-{row.t}
                            </span>
                          )}
                        </div>

                        {/* Win % */}
                        <div className="sys-row-card__pct-col">
                          <span className="sys-row-card__field-label">Win %</span>
                          {locked ? (
                            <span className="sys-row-card__pct sys-row-card__pct--neutral">—</span>
                          ) : (
                            <>
                              <span className={`sys-row-card__pct sys-row-card__pct--${winning ? 'win' : 'neutral'}`}>
                                {pctDisplay(row.pct)}
                              </span>
                              <div className="sys-row-card__bar">
                                <div className="sys-row-card__bar-fill" style={{ width: `${pctWidth}%` }} />
                              </div>
                            </>
                          )}
                        </div>

                        {/* Season */}
                        <div className="sys-row-card__field">
                          <span className="sys-row-card__field-label">Season</span>
                          <span className="sys-row-card__field-value">{row.season || '—'}</span>
                        </div>

                        {/* Date */}
                        <div className="sys-row-card__field">
                          <span className="sys-row-card__field-label">Date</span>
                          <span className="sys-row-card__field-value">{row.date || '—'}</span>
                        </div>

                        {/* Team */}
                        <div className="sys-row-card__field sys-row-card__field--wide">
                          <span className="sys-row-card__field-label">Team</span>
                          <span className="sys-row-card__field-value">{row.team || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Inline edit form — renders directly below the matching row */}
                    {isAdmin && editMode && formMode === 'edit' && editId === row.id && (
                      <div ref={inlineFormRef} className="admin-inline-form" style={{ margin: '4px 0 12px' }}>
                        <div className="admin-inline-form__title">Edit Betting System</div>
                        {formError && <div className="admin-inline-form__error">{formError}</div>}
                        <div className="admin-form-grid">
                          <div className="admin-form-field">
                            <label className="admin-form-label">Sport</label>
                            <select className="admin-form-select" value={form.sport} onChange={e => setField('sport', e.target.value)}>
                              {SPORTS.map(s => <option key={s} value={s}>{SPORT_LABELS[s]}</option>)}
                            </select>
                          </div>
                          <div className="admin-form-field admin-form-field--wide">
                            <label className="admin-form-label">Description / Rule</label>
                            <textarea className="admin-form-input" rows={2} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="e.g. Teams off 2+ days rest vs teams on back-to-back" />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">Line</label>
                            <input className="admin-form-input" value={form.line} onChange={e => setField('line', e.target.value)} placeholder="ATS, O/U, ML" />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">Season</label>
                            <input className="admin-form-input" value={form.season} onChange={e => setField('season', e.target.value)} placeholder="2023-24" />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">Type</label>
                            <input className="admin-form-input" value={form.type} onChange={e => setField('type', e.target.value)} placeholder="Situational, Trend" />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">Date</label>
                            <input className="admin-form-input" value={form.date} onChange={e => setField('date', e.target.value)} placeholder="e.g. 2024-01-15" />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">Team</label>
                            <input className="admin-form-input" value={form.team} onChange={e => setField('team', e.target.value)} placeholder="e.g. Lakers" />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">W</label>
                            <input className="admin-form-input" type="number" min={0} value={form.w} onChange={e => setField('w', +e.target.value)} />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">L</label>
                            <input className="admin-form-input" type="number" min={0} value={form.l} onChange={e => setField('l', +e.target.value)} />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">T</label>
                            <input className="admin-form-input" type="number" min={0} value={form.t} onChange={e => setField('t', +e.target.value)} />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">Pct (0.65 = 65%)</label>
                            <input className="admin-form-input" type="number" step="0.01" min={0} max={1} value={form.pct ?? ''} onChange={e => setField('pct', e.target.value)} placeholder="0.65" />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">Units</label>
                            <input className="admin-form-input" type="number" step="0.1" value={form.units ?? ''} onChange={e => setField('units', e.target.value)} placeholder="12.5" />
                          </div>
                          <div className="admin-form-field admin-form-field--checks">
                            <label className="admin-form-check">
                              <input type="checkbox" checked={form.is_free} onChange={e => setField('is_free', e.target.checked)} />
                              <span>Free tier access</span>
                            </label>
                            <label className="admin-form-check">
                              <input type="checkbox" checked={form.is_active} onChange={e => setField('is_active', e.target.checked)} />
                              <span>Active (visible on public page)</span>
                            </label>
                          </div>
                        </div>
                        <div className="admin-inline-form__actions">
                          <button className="btn btn--primary btn--sm" onClick={saveRow} disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button className="btn btn--outline btn--sm" onClick={cancelForm} disabled={saving}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </Fragment>
                )
              })}
            </div>
          )}
        </div>


        {isLoggedOut && (
          <div className="content-gate-overlay">
            <div className="content-gate-card">
              <div className="content-gate-card__icon">🔒</div>
              <h3 className="content-gate-card__title">Sign in to view betting systems</h3>
              <p className="content-gate-card__desc">
                Free members get access to free-tagged systems. Subscribe for full access.
              </p>
              <div className="content-gate-card__actions">
                <Link href="/login" className="btn btn--primary btn--sm">Sign In</Link>
                <Link href="/signup" className="btn btn--outline btn--sm">Create Free Account</Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {userTier === 'free' && systems.some(s => !s.is_free) && (
        <p className="gate-nudge reveal">
          &#128274; Some systems are for members only.{' '}
          <Link href="/betting-systems#pricing" className="gate-nudge__link">View plans &rarr;</Link>
        </p>
      )}

      {/* Admin FAB */}
      {isAdmin && (
        <div style={{
          position: 'fixed',
          bottom: '28px',
          right: '28px',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}>
          {editMode ? (
            <button
              onClick={() => { setEditMode(false); setFormMode('hidden'); setXlsxSheets(null) }}
              title="Exit edit mode"
              style={{ ...fabStyle, background: 'rgba(52,211,153,0.15)', color: 'var(--accent-green)', border: '2px solid rgba(52,211,153,0.35)' }}
            >
              ✕
            </button>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              title="Edit systems"
              style={{ ...fabStyle, background: 'var(--accent-green)', color: '#000', border: 'none' }}
            >
              ✏
            </button>
          )}
          {editMode && (
            <span style={{
              background: 'rgba(52,211,153,0.12)',
              border: '1px solid rgba(52,211,153,0.25)',
              color: 'var(--accent-green)',
              fontSize: '0.68rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '6px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              Editing
            </span>
          )}
        </div>
      )}
    </>
  )
}

const fabStyle: React.CSSProperties = {
  width: '54px',
  height: '54px',
  borderRadius: '50%',
  cursor: 'pointer',
  fontSize: '1.3rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  transition: 'transform 0.15s',
}
