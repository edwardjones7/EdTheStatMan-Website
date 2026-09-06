'use client'

import { useState, useRef, useEffect, Fragment } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'
import type { BettingSystem } from './AdminSystemsTab'
import LockedTeaserCard from './LockedTeaserCard'
import type { LockedTeaser } from '@/lib/teaser'
import { isPaidTier, normalizeTier, accessBadge, TIER_SHORT_LABEL, VAULT_ACCESS_OPTIONS, type Tier } from '@/lib/access'
import { nextCode, compareCode, codeKey } from '@/lib/codes'
import { IconLock, IconPencil } from './Icons'
import RecordStrip from './RecordStrip'

type Sport = 'all' | 'nfl' | 'nflpre' | 'cfl' | 'cfb' | 'nba' | 'wnba' | 'cbb'

interface Props {
  systems: BettingSystem[]
  /** Members-only row counts keyed by sport. Non-members get counts, not rows. */
  lockedCounts?: Record<string, number>
  lockedTeasers?: LockedTeaser[]
  /** Elite-only rows, redacted for everyone below elite (members included). */
  eliteLockedCounts?: Record<string, number>
  eliteTeasers?: LockedTeaser[]
  userTier: string | null
  isAdmin?: boolean
}

const TABS: { label: string; value: Sport }[] = [
  { label: 'All Sports', value: 'all' },
  { label: 'NFL', value: 'nfl' },
  { label: 'NFL Preseason', value: 'nflpre' },
  { label: 'CFL', value: 'cfl' },
  { label: 'College Football', value: 'cfb' },
  { label: 'NBA', value: 'nba' },
  { label: 'WNBA', value: 'wnba' },
  { label: 'College Basketball', value: 'cbb' },
]

const SPORT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  nba: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-gold)', label: 'NBA' },
  wnba: { bg: 'rgba(251, 146, 60, 0.1)', color: '#d98a6f', label: 'WNBA' },
  cbb: { bg: 'rgba(45, 212, 191, 0.1)', color: 'var(--accent-teal)', label: 'CBB' },
  nfl: { bg: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', label: 'NFL' },
  nflpre: { bg: 'rgba(125, 211, 252, 0.1)', color: '#7dd3fc', label: 'NFL Pre' },
  cfl: { bg: 'rgba(244, 63, 94, 0.1)', color: '#f43f5e', label: 'CFL' },
  cfb: { bg: 'rgba(233, 196, 106, 0.1)', color: 'var(--accent-gold)', label: 'CFB' },
}

const SPORTS = ['nba', 'wnba', 'cbb', 'nfl', 'nflpre', 'cfl', 'cfb'] as const
const SPORT_LABELS: Record<string, string> = { nba: 'NBA', wnba: 'WNBA', cbb: 'CBB', nfl: 'NFL', nflpre: 'NFL Preseason', cfl: 'CFL', cfb: 'College Football' }

const BLANK = {
  sport: 'cbb',
  // The business key, typed by hand: CFBS0001. openAdd() suggests the next one
  // for the sport you are on; the unique index on the table is what enforces it.
  code: '',
  description: '',
  season: '',
  pct: '' as number | null | string,
  w: 0,
  l: 0,
  t: 0,
  // Matches the column default in tier_ladder_02_content_min_tier.sql: a system
  // is Private unless someone says otherwise. is_free / is_elite are no longer
  // in the form -- saveRow derives them, see there for why they are still written.
  min_tier: 'private' as Tier,
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

/** Games behind a system's record — the sample size it's ranked on. */
function systemTotal(s: { w?: number | null; l?: number | null; t?: number | null }): number {
  return (s.w ?? 0) + (s.l ?? 0) + (s.t ?? 0)
}

// Sort priority: System ID ascending, uncoded rows last, then biggest sample
// size and highest win % for anything still tied. Mirrors compareByCode() in
// lib/gate.ts, which orders the same rows on the server -- the two must not
// drift, because that order also decides which rows become teasers.
function compareSystems(a: BettingSystem, b: BettingSystem): number {
  const byCode = compareCode(a.code, b.code)
  if (byCode !== 0) return byCode
  const totalDiff = systemTotal(b) - systemTotal(a)
  if (totalDiff !== 0) return totalDiff
  return (b.pct ?? -1) - (a.pct ?? -1)
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

export default function SportTabsSystem({ systems, lockedCounts = {}, lockedTeasers = [], eliteLockedCounts = {}, eliteTeasers = [], userTier, isAdmin = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // The selected sport lives in the URL (?sport=nfl) so it survives a
  // router.refresh() after add/edit/delete — and any remount — instead of
  // snapping back to "All Sports".
  const sportParam = searchParams.get('sport') as Sport | null
  const activeTab: Sport = sportParam && TABS.some(t => t.value === sportParam) ? sportParam : 'all'

  function selectTab(value: Sport) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all') params.delete('sport')
    else params.set('sport', value)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    cancelForm()
  }

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
  const [query, setQuery] = useState('')
  const inlineFormRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (formMode === 'edit' && editId) {
      setTimeout(() => inlineFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
    }
  }, [editId, formMode])

  const isPaid = isPaidTier(userTier)
  const isLoggedOut = userTier === null

  // Locked rows only exist for non-members; `systems` already excludes them.
  const totalLocked = Object.values(lockedCounts).reduce((a, b) => a + b, 0)
  // A locked teaser is a record and a sport, nothing else -- it carries no code
  // and no description by design (lib/teaser.ts), so it can never match a
  // search. While one is active the locked blocks are hidden rather than shown
  // as results that ignored what was typed.
  const searching = query.trim().length > 0
  const lockedForTab = isAdmin || searching ? [] : lockedTeasers.filter(t => activeTab === 'all' || t.sport === activeTab)
  const lockedCount = activeTab === 'all' ? totalLocked : (lockedCounts[activeTab] ?? 0)

  // Elite-locked rows exist for everyone below elite, members included.
  const totalEliteLocked = Object.values(eliteLockedCounts).reduce((a, b) => a + b, 0)
  const eliteLockedForTab = isAdmin || searching ? [] : eliteTeasers.filter(t => activeTab === 'all' || t.sport === activeTab)
  const eliteLockedCount = activeTab === 'all' ? totalEliteLocked : (eliteLockedCounts[activeTab] ?? 0)

  const activeTabLabel = TABS.find(t => t.value === activeTab)!.label

  // Sport tab first, then the search box. Codes are compared as codeKey(),
  // which collapses padding and punctuation, so "cfbs 1", "CFBS0001" and
  // "cfbs-0001" all find the same row -- nobody types a padded key exactly.
  const q = query.trim().toLowerCase()
  const qCode = codeKey(query)
  const allVisible = systems
    .filter(s => activeTab === 'all' || s.sport === activeTab)
    .filter(s => {
      if (!q) return true
      if (qCode && codeKey(s.code).includes(qCode)) return true
      return [s.description, s.season]
        .some(v => (v ?? '').toLowerCase().includes(q))
    })
  const baseRows = editMode
    ? [...allVisible].sort((a, b) =>
        (Number(b.is_active) - Number(a.is_active)) || compareSystems(a, b)
      )
    : allVisible
        .filter(s => s.is_active)
        .sort(compareSystems)


  function openAdd() {
    // Default a new row to the sport you're currently viewing, so adding while
    // on the NFL tab creates an NFL system (not the blank default), and suggest
    // the next free code for that sport from the rows already on the page.
    const sport = activeTab !== 'all' ? activeTab : BLANK.sport
    setForm({ ...BLANK, sport, code: nextCode(sport, 'S', systems.map(s => s.code)) })
    setEditId(null)
    setFormMode('add')
    setFormError(null)
  }

  function openEdit(s: BettingSystem) {
    setForm({
      sport: s.sport,
      code: s.code ?? '',
      description: s.description,
      season: s.season,
      pct: s.pct,
      w: s.w,
      l: s.l,
      t: s.t,
      // normalizeTier so a legacy or unrecognised stored value opens as a real
      // option rather than leaving the select with nothing selected.
      min_tier: normalizeTier(s.min_tier),
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
    const w = Number(form.w) || 0
    const l = Number(form.l) || 0
    const payload = {
      ...form,
      pct: (w + l) > 0 ? w / (w + l) : null,
      // Null, not '', for a blank code: the unique index treats NULLs as
      // distinct, so any number of uncoded rows can coexist, while two rows
      // both storing '' would collide on the second save.
      code: form.code.trim() ? form.code.trim().toUpperCase() : null,
      // min_tier is the gate. is_free and is_elite are written alongside it only
      // to stop the old pair drifting into a contradiction: the XLSX importer
      // and the stats bar still read is_free, and lib/gate.ts falls back to the
      // pair if min_tier is ever absent, so a row saying free=true/tier=private
      // would be a trap waiting for whichever path looked first. is_elite is
      // pinned false because nothing produces it any more.
      is_free: form.min_tier === 'retail',
      is_elite: false,
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
        const sport = lower.includes('nfl pre') || lower.includes('nflpre') || lower.includes('preseason') ? 'nflpre'
          : lower.includes('nfl') ? 'nfl'
          : lower.includes('wnba') ? 'wnba'
          : lower.includes('nba') ? 'nba'
          : lower.includes('cfl') ? 'cfl'
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
          .map((row, j) => {
            const w = parseIntVal(row['w'] ?? row['W'] ?? row['wins'] ?? row['Wins'] ?? 0)
            const l = parseIntVal(row['l'] ?? row['L'] ?? row['losses'] ?? row['Losses'] ?? 0)
            return {
              sport: sheet.sport,
              // Every spelling of the ID column a sheet might carry. Blank
              // stays null rather than '' -- see saveRow for why.
              code: parseStr(
                row['code'] ?? row['Code'] ?? row['CODE'] ??
                row['system id'] ?? row['System ID'] ?? row['SYSTEM ID'] ??
                row['systemid'] ?? row['SystemID'] ?? row['systemId'] ??
                row['id'] ?? row['ID'] ?? ''
              ).trim().toUpperCase() || null,
              description: parseStr(row['description'] ?? row['Description'] ?? row['DESCRIPTION'] ?? row['rule'] ?? row['Rule'] ?? ''),
              season: parseStr(row['season'] ?? row['Season'] ?? row['SEASON'] ?? ''),
              pct: (w + l) > 0 ? w / (w + l) : null,
              w,
              l,
              t: parseIntVal(row['t'] ?? row['T'] ?? row['ties'] ?? row['Ties'] ?? 0),
              // Same rule as saveRow: min_tier is the gate, is_free rides along
              // so the two cannot disagree. An imported sheet only ever says
              // free or not, so it can reach Free or Private and never
              // Institutional -- that is a per-row editorial call, made after.
              min_tier: sheet.is_free ? 'retail' : 'private',
              is_free: sheet.is_free,
              is_elite: false,
              is_active: true,
              sort_order: j,
            }
          })
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

  if (systems.length === 0 && totalLocked === 0 && totalEliteLocked === 0 && !editMode) {
    return (
      <>
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          No betting systems available yet. Check back soon.
        </div>
        {isAdmin && (
          <div style={{ position: 'fixed', bottom: '28px', left: '28px', zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setEditMode(true)}
              title="Edit systems"
              style={{ ...fabStyle, background: 'var(--accent-teal)', color: '#000', border: 'none' }}
            >
              <IconPencil size={14} />
            </button>
          </div>
        )}
      </>
    )
  }

  // Stats bar computed values — counts follow the selected sport tab. Members
  // see their rows directly; non-members only ever have the locked count.
  const activeSystems = allVisible.filter(s => s.is_active)
  const freeCount = activeSystems.filter(s => normalizeTier(s.min_tier) === 'retail').length
  const eliteVisibleCount = activeSystems.filter(s => normalizeTier(s.min_tier) === 'institutional').length
  const eliteCount = eliteVisibleCount + eliteLockedCount
  const memberCount = activeSystems.length - freeCount - eliteVisibleCount + lockedCount
  const totalCount = freeCount + memberCount + eliteCount

  return (
    <>
      {/* Summary stats bar */}
      <div className="sys-stats-bar reveal" style={{ marginTop: '32px' }}>
        <div className="sys-stats-chip">
          <span className="sys-stats-chip__label">{TIER_SHORT_LABEL.retail} Systems</span>
          <span className="sys-stats-chip__value">{freeCount}</span>
        </div>
        <div className="sys-stats-chip">
          <span className="sys-stats-chip__label">{TIER_SHORT_LABEL.private} Systems</span>
          <span className="sys-stats-chip__value">{memberCount}</span>
        </div>
        {eliteCount > 0 && (
          <div className="sys-stats-chip sys-stats-chip--elite">
            <span className="sys-stats-chip__label">{TIER_SHORT_LABEL.institutional} Systems</span>
            <span className="sys-stats-chip__value">{eliteCount}</span>
          </div>
        )}
        <div className="sys-stats-chip">
          <span className="sys-stats-chip__label">Total Systems</span>
          <span className="sys-stats-chip__value">{totalCount}</span>
        </div>
      </div>

      {/* Sport tabs */}
      <div className="sport-tabs reveal">
        {TABS.map(tab => (
          <button
            key={tab.value}
            className={`sport-tab${activeTab === tab.value ? ' active' : ''}`}
            onClick={() => selectTab(tab.value)}
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
            style={{ borderColor: 'rgba(45,212,191,0.4)', color: 'var(--accent-teal)' }}
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
                    color: sheet.is_free ? '#38bdf8' : 'var(--accent-gold)',
                  }}
                >
                  {sheet.is_free ? 'Free' : 'Private'}
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
            <div className="admin-form-field">
              <label className="admin-form-label">System ID</label>
              <input className="admin-form-input" value={form.code} onChange={e => setField('code', e.target.value.toUpperCase())} placeholder="CFBS0001" />
            </div>
            <div className="admin-form-field admin-form-field--wide">
              <label className="admin-form-label">Description / Rule</label>
              <textarea className="admin-form-input" rows={2} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="e.g. Teams off 2+ days rest vs teams on back-to-back" />
            </div>
            <div className="admin-form-field">
              <label className="admin-form-label">Season</label>
              <input className="admin-form-input" value={form.season} onChange={e => setField('season', e.target.value)} placeholder="2023-24" />
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
              <label className="admin-form-label">Access</label>
              <select
                className="admin-form-input"
                value={form.min_tier}
                onChange={e => setField('min_tier', e.target.value as Tier)}
              >
                {VAULT_ACCESS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="admin-form-field admin-form-field--checks">
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

      {/* Free rows sit above the paywall. Locked rows reach the client only as
          redacted teasers (sport + record + win%); the description -- the rule
          itself -- never leaves the server. See lib/teaser.ts. */}
      {lockedCount > 0 && baseRows.length > 0 && !searching && (
        <div className="sys-free-heading">Free Systems</div>
      )}


      {/* Search. The ID is the point of it -- someone comes here holding
          CFBS0001, not a description -- but the same box matches the rule text
          and the season so a half-remembered row is still findable. */}
      <div className="vault-search">
        <label className="vault-search__label" htmlFor="vault-search-systems">Search</label>
        <input
          id="vault-search-systems"
          className="vault-search__input"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by ID (CFBS0001) or keyword"
          autoComplete="off"
        />
        {query.trim() && (
          <span className="vault-search__count">
            {baseRows.length} match{baseRows.length === 1 ? '' : 'es'}
          </span>
        )}
      </div>

      {/* Card grid */}
      <div className="content-gate-wrap" style={{ marginTop: '24px' }}>
        <div>
          {baseRows.length === 0 ? (
            lockedCount === 0 && (
              <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                {searching ? 'Nothing matches that search.' : 'No systems in this sport.'}
              </div>
            )
          ) : (
            <div className="sys-card-grid">
              {baseRows.map(row => {
                const style = SPORT_STYLE[row.sport] ?? { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', label: row.sport.toUpperCase() }
                const winning = row.w > row.l

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

                        {/* System ID */}
                        <div className="sys-row-card__field">
                          <span className="sys-row-card__field-label">ID</span>
                          <span className="sys-row-card__field-value">{row.code || '—'}</span>
                        </div>

                        {/* Description */}
                        <div className="sys-row-card__desc-col">
                          <div className="sys-row-card__desc">
                            {row.description || <em style={{ color: 'var(--text-muted)' }}>No description</em>}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {/* Non-members only ever see free rows, so the badge
                                would be noise on every card. */}
                            {(isPaid || isAdmin) && (
                              <span className={`sys-row-card__access-badge sys-row-card__access-badge--${accessBadge(row.min_tier).variant}`}>
                                {accessBadge(row.min_tier).label}
                              </span>
                            )}
                            {isAdmin && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center',
                                padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '0.68rem', fontWeight: 600,
                                background: row.is_active ? 'rgba(45,212,191,0.12)' : 'rgba(239,68,68,0.12)',
                                color: row.is_active ? 'var(--accent-teal)' : '#ef4444',
                              }}>
                                {row.is_active ? 'Active' : 'Inactive'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Record */}
                        <div className="sys-row-card__field">
                          <span className="sys-row-card__field-label">Record</span>
                          <span className={`sys-row-card__record sys-row-card__record--${winning ? 'win' : row.w < row.l ? 'loss' : 'neutral'}`}>
                            {row.w}-{row.l}-{row.t}
                          </span>
                        </div>

                        {/* Win % */}
                        <div className="sys-row-card__pct-col">
                          <span className="sys-row-card__field-label">Win %</span>
                          <span className={`sys-row-card__pct sys-row-card__pct--${winning ? 'win' : 'neutral'}`}>
                            {pctDisplay(row.pct)}
                          </span>
                          <RecordStrip w={row.w} l={row.l} t={row.t} />
                        </div>

                        {/* Season */}
                        <div className="sys-row-card__field">
                          <span className="sys-row-card__field-label">Season</span>
                          <span className="sys-row-card__field-value">{row.season || '—'}</span>
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
                          <div className="admin-form-field">
                            <label className="admin-form-label">System ID</label>
                            <input className="admin-form-input" value={form.code} onChange={e => setField('code', e.target.value.toUpperCase())} placeholder="CFBS0001" />
                          </div>
                          <div className="admin-form-field admin-form-field--wide">
                            <label className="admin-form-label">Description / Rule</label>
                            <textarea className="admin-form-input" rows={2} value={form.description} onChange={e => setField('description', e.target.value)} placeholder="e.g. Teams off 2+ days rest vs teams on back-to-back" />
                          </div>
                          <div className="admin-form-field">
                            <label className="admin-form-label">Season</label>
                            <input className="admin-form-input" value={form.season} onChange={e => setField('season', e.target.value)} placeholder="2023-24" />
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
                            <label className="admin-form-label">Access</label>
                            <select
                              className="admin-form-input"
                              value={form.min_tier}
                              onChange={e => setField('min_tier', e.target.value as Tier)}
                            >
                              {VAULT_ACCESS_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="admin-form-field admin-form-field--checks">
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


      </div>

      {!isAdmin && eliteLockedForTab.length > 0 && (
        <>
          <div className="sys-locked-heading sys-locked-heading--elite">
            <IconLock size={13} /> Institutional Intelligence — records shown, rows hidden
          </div>
          <div className="sys-card-grid">
            {eliteLockedForTab.map(t => (
              <LockedTeaserCard
                key={t.id}
                teaser={t}
                sportLabel={SPORT_STYLE[t.sport]?.label ?? t.sport.toUpperCase()}
                sportClass={t.sport}
                variant="elite"
              />
            ))}
          </div>
        </>
      )}

      {eliteLockedCount > 0 && (
        <div className="sys-gate-card sys-gate-card--elite reveal">
          <div className="sys-gate-card__icon"><IconLock size={30} /></div>
          <div className="content-gate-card__title">
            {eliteLockedCount} Institutional system{eliteLockedCount !== 1 ? 's' : ''}
            {activeTab !== 'all' && ` in ${activeTabLabel}`}
          </div>
          <p className="content-gate-card__desc">
            Our highest-conviction, curated edges — Institutional members only.
          </p>
          <div className="content-gate-card__actions">
            <Link href="/win" className="btn btn--primary">Go Institutional &rarr;</Link>
          </div>
        </div>
      )}

      {!isAdmin && lockedForTab.length > 0 && (
        <>
          <div className="sys-locked-heading">
            <IconLock size={13} /> Private Intelligence — records shown, systems hidden
          </div>
          <div className="sys-card-grid">
            {lockedForTab.map(t => (
              <LockedTeaserCard
                key={t.id}
                teaser={t}
                sportLabel={SPORT_STYLE[t.sport]?.label ?? t.sport.toUpperCase()}
                sportClass={t.sport}
              />
            ))}
          </div>
        </>
      )}

      {lockedCount > 0 && (
        <div className="sys-gate-card reveal">
          <div className="sys-gate-card__icon"><IconLock size={30} /></div>
          <div className="content-gate-card__title">
            {lockedCount} more system{lockedCount !== 1 ? 's' : ''}
            {activeTab !== 'all' && ` in ${activeTabLabel}`}
          </div>
          <p className="content-gate-card__desc">
            Full records, win percentages, and season data — Private Intelligence and above.
          </p>
          <div className="content-gate-card__actions">
            <Link href="/win" className="btn btn--primary">Open the Vault &rarr;</Link>
            {isLoggedOut && <Link href="/login" className="btn btn--outline">Sign in</Link>}
          </div>
        </div>
      )}

      {/* Admin FAB */}
      {isAdmin && (
        <div style={{
          /* Bottom-LEFT. It moved here when EdTheStatBot's FAB took the
             bottom-right corner; the bot is parked now, but .back-to-top has
             taken that corner back, so this stays where it is. */
          position: 'fixed',
          bottom: '28px',
          left: '28px',
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
              style={{ ...fabStyle, background: 'rgba(45,212,191,0.15)', color: 'var(--accent-teal)', border: '2px solid rgba(45,212,191,0.35)' }}
            >
              ✕
            </button>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              title="Edit systems"
              style={{ ...fabStyle, background: 'var(--accent-teal)', color: '#000', border: 'none' }}
            >
              <IconPencil size={14} />
            </button>
          )}
          {editMode && (
            <span style={{
              background: 'rgba(45,212,191,0.12)',
              border: '1px solid rgba(45,212,191,0.25)',
              color: 'var(--accent-teal)',
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
