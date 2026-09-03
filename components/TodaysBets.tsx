'use client'

import { useState, useRef, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ModelPicksContent } from '@/lib/site-content'
import type { LockedBetTeaser } from '@/lib/teaser'
import EditableText from './EditableText'
import { IconLock, IconBolt, IconChat, IconChartBar, IconTrendUp } from './Icons'

export interface TodaysBet {
  id: string
  date: string | null
  sport: string | null
  risk: string | null
  bet: string | null
  line: string | null
  vig: string | null
  opponent: string | null
  win: string | null
  result: string | null
  note: string | null
  is_active: boolean
  is_free: boolean
  is_elite: boolean
  show_on_results: boolean
  created_at: string
}

interface Props {
  rows: TodaysBet[]
  isAdmin: boolean
  userTier: string | null  // null = logged out
  isMember: boolean
  /** Picks withheld from a non-member. */
  lockedCount?: number
  /** Redacted stand-ins for those picks — date/sport/result only. */
  lockedBets?: LockedBetTeaser[]
  /** Edge picks withheld from everyone below elite — members included. */
  eliteLockedBets?: LockedBetTeaser[]
  editMode?: boolean
  headerContent?: ModelPicksContent
  onHeaderEdit?: (updates: Partial<ModelPicksContent>) => void
  resetKey?: number
}

const RESULT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  win:     { bg: 'rgba(45,212,191,0.15)',  color: '#2dd4bf', label: 'Win' },
  loss:    { bg: 'rgba(239,68,68,0.15)',   color: '#f8717a', label: 'Loss' },
  push:    { bg: 'rgba(234,179,8,0.15)',   color: '#facc15', label: 'Push' },
  pending: { bg: 'rgba(161,161,170,0.08)', color: 'var(--text-muted)', label: 'Pending' },
}

/**
 * Mirror of NotifyResult from lib/notify. Every channel there degrades to a
 * silent no-op when its key is missing, so without this reported back a
 * misconfigured deploy is indistinguishable from a working one.
 */
interface NotifyReport {
  skipped?: string
  audience?: string
  discord?: { sent: number; mentioned: string | null } | { error: string }
  email?: { sent: number; failed: number; errors?: string[] } | { error: string }
  push?: { sent: number; pruned: number } | { error: string }
}

function channelSummary(name: string, result: NotifyReport[keyof NotifyReport]): string {
  if (!result || typeof result !== 'object') return `${name}: —`
  if ('error' in result) return `${name}: failed (${result.error})`
  if ('mentioned' in result) {
    return result.sent === 0
      ? `${name}: not configured`
      : `${name}: posted${result.mentioned ? ' + role ping' : ' (no role ping)'}`
  }
  if ('failed' in result) {
    const tail = result.failed > 0 ? `, ${result.failed} failed` : ''
    return `${name}: ${result.sent} sent${tail}`
  }
  if ('pruned' in result) {
    const tail = result.pruned > 0 ? `, ${result.pruned} stale removed` : ''
    return `${name}: ${result.sent} sent${tail}`
  }
  return `${name}: —`
}

const EMPTY_FORM = {
  date: '', sport: '', risk: '', bet: '', line: '', vig: '', opponent: '', win: '', result: 'pending', note: '',
  is_active: true, is_free: true, is_elite: false, show_on_results: false,
}

export default function TodaysBets({ rows, isAdmin, userTier, isMember, lockedCount = 0, lockedBets = [], eliteLockedBets = [], editMode = false, headerContent, onHeaderEdit, resetKey = 0 }: Props) {
  const router = useRouter()
  const [formMode, setFormMode]   = useState<'hidden' | 'add' | 'edit'>('hidden')
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [notifyReport, setNotifyReport] = useState<NotifyReport | null>(null)
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
    setNotifyReport(null)
  }

  function openEdit(row: TodaysBet) {
    setForm({
      date:            row.date   ?? '',
      sport:           row.sport  ?? '',
      risk:            row.risk   ?? '',
      bet:             row.bet    ?? '',
      line:            row.line     ?? '',
      vig:             row.vig      ?? '',
      opponent:        row.opponent ?? '',
      win:             row.win      ?? '',
      result:          row.result ?? 'pending',
      note:            row.note   ?? '',
      is_active:       row.is_active,
      is_free:         row.is_free,
      is_elite:        row.is_elite ?? false,
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
      const j = await res.json()
      if (!res.ok) throw new Error(j.error ?? 'Save failed')
      cancelForm()
      // Only a create fans out notifications; an edit returns no report.
      setNotifyReport(isEdit ? null : (j.notified ?? null))
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

  function groupOrder(note: string | null) {
    if (note === 'Live')   return 0
    if (note === 'Future') return 1
    return 2
  }

  // The `date` column is free text (e.g. "Mar 18") with no year, so we parse it
  // against the row's created_at year and fall back to created_at when it can't
  // be parsed. Returns a comparable timestamp (ms).
  function dateValue(row: TodaysBet) {
    const created = Date.parse(row.created_at)
    if (row.date) {
      // Try parsing as-is first (handles ISO dates like "2026-06-17").
      const direct = Date.parse(row.date)
      if (!Number.isNaN(direct)) return direct
      // Fall back to appending a year for bare formats like "Mar 18".
      const year = Number.isNaN(created) ? new Date().getFullYear() : new Date(created).getFullYear()
      const withYear = Date.parse(`${row.date} ${year}`)
      if (!Number.isNaN(withYear)) return withYear
    }
    return Number.isNaN(created) ? 0 : created
  }

  // One list — no free/members split. Non-members simply never receive the
  // locked rows; what arrives here is already theirs to see.
  const baseRows = isAdmin && editMode ? rows : rows.filter(r => !r.show_on_results)
  const visibleRows = baseRows
  const sortedRows = [...visibleRows].sort((a, b) => {
    const dateDiff = dateValue(b) - dateValue(a)  // newest first
    if (dateDiff !== 0) return dateDiff
    const grp = groupOrder(a.note) - groupOrder(b.note)
    if (grp !== 0) return grp
    // Edge picks lead their slate — it's what elite members paid for.
    const elite = Number(!!b.is_elite) - Number(!!a.is_elite)
    if (elite !== 0) return elite
    return Number(b.is_free) - Number(a.is_free)
  })
  const rs = (result: string | null) => RESULT_STYLE[result ?? 'pending'] ?? RESULT_STYLE.pending

  const displayRows = sortedRows

  return (
    <section id="todays-action" className="section todays-action">
      <div className="container">
        <div className="reveal">
          {editMode && onHeaderEdit ? (
            <>
              <EditableText tag="span" className="section-label" value={headerContent?.sectionLabel ?? 'Daily Picks'} onChange={v => onHeaderEdit({ sectionLabel: v })} resetKey={resetKey} style={{ display: 'block' }} />
              <EditableText tag="h2" className="section-title" value={headerContent?.sectionTitle ?? "What I'm Betting Today"} onChange={v => onHeaderEdit({ sectionTitle: v })} resetKey={resetKey} style={{ display: 'block' }} />
              <EditableText tag="p" className="section-subtitle" value={headerContent?.sectionSubtitle ?? 'My active plays — updated daily.'} onChange={v => onHeaderEdit({ sectionSubtitle: v })} resetKey={resetKey} style={{ display: 'block' }} />
            </>
          ) : (
            <>
              <span className="section-label">{headerContent?.sectionLabel ?? 'Daily Picks'}</span>
              <h2 className="section-title">{headerContent?.sectionTitle ?? "What I'm Betting Today"}</h2>
              <p className="section-subtitle">{headerContent?.sectionSubtitle ?? 'My active plays — updated daily.'}</p>
            </>
          )}
        </div>

        {/* Add row button (shown when FAB edit mode is active) */}
        {isAdmin && editMode && (
          <div style={{ margin: '28px 0 16px' }}>
            <button className="btn btn--primary btn--sm" onClick={openAdd}>
              + Add Row
            </button>
          </div>
        )}

        {/* Notification outcome for the pick just created. */}
        {isAdmin && editMode && notifyReport && (
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${notifyReport.skipped ? '#facc15' : '#2dd4bf'}`,
              borderRadius: '8px',
              padding: '12px 16px',
              margin: '0 0 16px',
              fontSize: '0.82rem',
              lineHeight: 1.7,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>
                {notifyReport.skipped
                  ? `Not announced — ${notifyReport.skipped}`
                  : `Announced to: ${notifyReport.audience}`}
              </strong>
              <button
                type="button"
                onClick={() => setNotifyReport(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
            {!notifyReport.skipped && (
              <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                {channelSummary('Discord', notifyReport.discord)}
                {' · '}
                {channelSummary('Email', notifyReport.email)}
                {' · '}
                {channelSummary('Push', notifyReport.push)}
              </div>
            )}
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

        {/* No rows yet — suppressed when a paywall follows, which speaks for itself */}
        {visibleRows.length === 0 && !isAdmin && lockedCount === 0 && eliteLockedBets.length === 0 && (
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

        {/* Table — also rendered when the only rows are locked stand-ins */}
        {(visibleRows.length > 0 || lockedBets.length > 0 || eliteLockedBets.length > 0) && (
          <div className="content-gate-wrap" style={{ marginTop: '28px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Date', 'Sport', 'Pick', 'Guide Line', 'Closing Line', 'Opponent', 'Result', 'Note'].map(col => (
                      <th key={col} style={thStyle}>{col}</th>
                    ))}
                    {isAdmin && editMode && <th style={thStyle} />}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row: any) => {
                      return (
                      <Fragment key={row.id}>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span>{row.date ?? '—'}</span>
                              {!isLoggedOut && (row.is_active || isMember) && (
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {row.is_active && (
                                    <span style={tagStyle('var(--accent-teal)', 'rgba(45,212,191,0.12)')}>Active</span>
                                  )}
                                  {/* Gate state is only meaningful to someone who
                                      can see both kinds — otherwise every row is free. */}
                                  {isMember && (
                                    row.is_elite
                                      ? <span style={tagStyle('var(--accent-gold)', 'rgba(var(--gold-rgb),0.18)')}>Edge</span>
                                      : row.is_free
                                      ? <span style={tagStyle('#38bdf8', 'rgba(56,189,248,0.12)')}>Free</span>
                                      : <span style={tagStyle('var(--accent-gold)', 'rgba(var(--gold-rgb),0.12)')}>Members</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, color: 'var(--accent-teal)', fontWeight: 600 }}>{row.sport ?? '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 600, maxWidth: '200px' }}>{row.bet ?? '—'}</td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{row.line ?? '—'}</td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{row.vig ?? '—'}</td>
                          <td style={tdStyle}>{row.opponent ?? '—'}</td>
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
                                style={{ marginLeft: '6px', color: '#f8717a' }}
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
                            <td colSpan={8} style={{ padding: 0 }}>
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

                  {/* Edge picks locked for everyone below elite — same redaction
                      rules as member-locked rows, gold Elite treatment. */}
                  {eliteLockedBets.map(t => (
                    <tr key={t.id} className="bet-row--locked bet-row--elite-locked" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span>{t.date ?? '—'}</span>
                          <span style={tagStyle('var(--accent-gold)', 'rgba(var(--gold-rgb),0.18)')}>Edge</span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--accent-teal)', fontWeight: 600 }}>{t.sport ?? '—'}</td>
                      <td style={{ ...tdStyle, maxWidth: '200px' }}>
                        <span className="bet-cell-redacted" aria-hidden="true" />
                        <span className="sr-only">Elite-only Edge pick</span>
                      </td>
                      <td style={tdStyle}><span className="bet-cell-redacted bet-cell-redacted--sm" aria-hidden="true" /></td>
                      <td style={tdStyle}><span className="bet-cell-redacted bet-cell-redacted--sm" aria-hidden="true" /></td>
                      <td style={tdStyle}><span className="bet-cell-redacted bet-cell-redacted--sm" aria-hidden="true" /></td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          background: rs(t.result).bg,
                          color: rs(t.result).color,
                        }}>
                          {rs(t.result).label}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <Link href="/win" className="bet-unlock-link bet-unlock-link--elite">
                          <IconLock size={12} /> Go Elite
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {/* Locked picks — the row still runs across, but the pick and
                      everything that would identify it is a blank bar. These
                      carry no bet text: the server never sent any. */}
                  {lockedBets.map(t => (
                    <tr key={t.id} className="bet-row--locked" style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>{t.date ?? '—'}</td>
                      <td style={{ ...tdStyle, color: 'var(--accent-teal)', fontWeight: 600 }}>{t.sport ?? '—'}</td>
                      <td style={{ ...tdStyle, maxWidth: '200px' }}>
                        <span className="bet-cell-redacted" aria-hidden="true" />
                        <span className="sr-only">Members-only pick</span>
                      </td>
                      <td style={tdStyle}><span className="bet-cell-redacted bet-cell-redacted--sm" aria-hidden="true" /></td>
                      <td style={tdStyle}><span className="bet-cell-redacted bet-cell-redacted--sm" aria-hidden="true" /></td>
                      <td style={tdStyle}><span className="bet-cell-redacted bet-cell-redacted--sm" aria-hidden="true" /></td>
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-block',
                          padding: '2px 10px',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          background: rs(t.result).bg,
                          color: rs(t.result).color,
                        }}>
                          {rs(t.result).label}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <Link href="/win" className="bet-unlock-link">
                          <IconLock size={12} /> Unlock
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* Action buttons */}
        <div style={{ marginTop: '32px', display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href="https://x.com/EdTheStatMan" className="btn btn--primary btn--sm" target="_blank" rel="noopener">
            <IconBolt size={14} /> Follow on X
          </a>
          <a href="https://discord.gg/rXBZkSPcJb" className="btn btn--secondary btn--sm" target="_blank" rel="noopener">
            <IconChat size={14} /> Join Discord
          </a>
          <Link href="/vault/systems" className="btn btn--outline btn--sm">
            <IconChartBar size={14} /> View All Systems
          </Link>
          <Link href="/vault/trends" className="btn btn--outline btn--sm">
            <IconTrendUp size={14} /> View All Trends
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
      {error && <p style={{ color: '#f8717a', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { name: 'date',     label: 'Date',         placeholder: 'Mar 18' },
          { name: 'sport',    label: 'Sport',        placeholder: 'NFL' },
          { name: 'bet',      label: 'Pick',         placeholder: 'Chiefs -3.5' },
          { name: 'line',     label: 'Guide Line',   placeholder: '-110' },
          { name: 'vig',      label: 'Closing Line', placeholder: '-110' },
          { name: 'opponent', label: 'Opponent',     placeholder: 'Broncos' },
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
          onColor="var(--accent-teal)"
          onClick={() => setField('is_active', !form.is_active)}
        />
        <ToggleBtn
          label="Free"
          active={form.is_free}
          onColor="var(--accent-teal)"
          onClick={() => setField('is_free', !form.is_free)}
        />
        <ToggleBtn
          label="Elite (Edge pick)"
          active={form.is_elite}
          onColor="var(--accent-gold)"
          onClick={() => setField('is_elite', !form.is_elite)}
        />
        <ToggleBtn
          label="Show on Results"
          active={form.show_on_results}
          onColor="var(--accent-teal)"
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
