'use client'

/**
 * Pick editing, in place. Replaces the old editors that rendered a second copy
 * of every pick under the public page.
 *
 *   <PicksAdmin rows={...} />   on a page: registers the rows and puts
 *                               "+ Post pick", "Grade" and "All picks" in the bar
 *   <PickRowActions id=... />   on a public row or tile: edit, W/L/P, delete
 *
 * Grading goes through PATCH /api/admin/todays-bets/[id], which writes only the
 * result. Editing goes through PUT with the whole form, min_tier included.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeTier, PICK_ACCESS_OPTIONS, type Tier } from '@/lib/access'
import type { TodaysBet } from '@/components/TodaysBets'
import { AdminActions, useAdminKit, type AdminKit } from './AdminKit'

// ── Row registry ────────────────────────────────────────────────────────────
// Tiles and ledger rows only carry an id; the full row (for the edit form)
// comes from whatever the page registered.

let registry = new Map<string, TodaysBet>()
const listeners = new Set<() => void>()
function setRows(rows: TodaysBet[]) {
  registry = new Map(rows.map(r => [String(r.id), r]))
  listeners.forEach(l => l())
}
function subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } }
function useRows(): Map<string, TodaysBet> {
  return useSyncExternalStore(subscribe, () => registry, () => registry)
}

// ── Shared actions ──────────────────────────────────────────────────────────

type Grade = 'win' | 'loss' | 'push' | 'pending'
const GRADE_LABEL: Record<Grade, string> = { win: 'W', loss: 'L', push: 'P', pending: '—' }
const GRADE_WORD: Record<Grade, string> = { win: 'Win', loss: 'Loss', push: 'Push', pending: 'Pending' }

function describe(row: TodaysBet | undefined): string {
  if (!row) return 'this pick'
  return [row.sport, row.bet, row.line].filter(Boolean).join(' ')
}

async function grade(kit: AdminKit, row: TodaysBet, result: Grade, refresh: () => void) {
  const res = await fetch(`/api/admin/todays-bets/${row.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    // A real grade puts the pick on the public record ("graded in public").
    // Undoing to pending leaves that flag alone.
    body: JSON.stringify(result === 'pending' ? { result } : { result, show_on_results: true }),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok) { kit.toast(`Couldn’t grade ${describe(row)}: ${j.error ?? res.status}`, 'error'); return }
  kit.toast(result === 'pending' ? `${describe(row)} set back to pending` : `${describe(row)} graded ${GRADE_WORD[result]}`)
  refresh()
}

async function remove(kit: AdminKit, row: TodaysBet, refresh: () => void) {
  const ok = await kit.confirm({
    title: 'Delete this pick?',
    body: <>{describe(row)}{row.date ? ` · ${row.date}` : ''}. It comes off the card and the record, and it can&rsquo;t be undone.</>,
    confirm: 'Delete pick',
    danger: true,
  })
  if (!ok) return
  const res = await fetch(`/api/admin/todays-bets/${row.id}`, { method: 'DELETE' })
  if (!res.ok) { kit.toast(`Couldn’t delete ${describe(row)}`, 'error'); return }
  kit.toast(`Deleted ${describe(row)}`)
  kit.setPanelDirty(false)
  kit.closePanel()
  refresh()
}

// ── Inline controls ─────────────────────────────────────────────────────────

export function PickRowActions({ id, hint, compact = false }: {
  id: string
  /** What the live score says the result is: that button is highlighted. */
  hint?: 'win' | 'loss' | 'push' | null
  compact?: boolean
}) {
  const kit = useAdminKit()
  const rows = useRows()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const row = rows.get(String(id))
  if (!kit || !row) return null

  const current = (String(row.result ?? 'pending').toLowerCase() as Grade)
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn() } finally { setBusy(false) } }

  const buttons = (
    <span className="akit-row" role="group" aria-label={`Admin: ${describe(row)}`}>
      <button type="button" className="akit-chip" title="Edit pick" aria-label="Edit pick" disabled={busy}
        onClick={() => openEditor(kit, row)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>
      </button>
      {(['win', 'loss', 'push'] as const).map(g => (
        <button
          key={g}
          type="button"
          className={`akit-chip is-${g}${current === g ? ' is-on' : ''}${hint === g && current === 'pending' ? ' is-hint' : ''}`}
          title={current === g ? `Graded ${GRADE_WORD[g]}. Click to set back to pending.` : `Grade ${GRADE_WORD[g]}`}
          aria-pressed={current === g}
          disabled={busy}
          onClick={() => run(() => grade(kit, row, current === g ? 'pending' : g, () => router.refresh()))}
        >
          {GRADE_LABEL[g]}
        </button>
      ))}
      <button type="button" className="akit-chip akit-chip--danger" title="Delete pick" aria-label="Delete pick" disabled={busy}
        onClick={() => run(() => remove(kit, row, () => router.refresh()))}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
      </button>
    </span>
  )

  if (compact) return buttons
  return (
    <div className="akit-tilebar">
      <span className="akit-tilebar__label">{hint && current === 'pending' ? `Final says ${GRADE_WORD[hint]}` : 'Admin'}</span>
      {buttons}
    </div>
  )
}

// ── The edit form ───────────────────────────────────────────────────────────

const EMPTY = {
  date: '', sport: '', risk: '', bet: '', line: '', vig: '', opponent: '', win: '', result: 'pending', note: '',
  is_active: true, min_tier: 'retail' as Tier, show_on_results: false, game_id: 'auto',
}
type Form = typeof EMPTY

function formOf(row: TodaysBet): Form {
  return {
    date: row.date ?? '', sport: row.sport ?? '', risk: row.risk ?? '', bet: row.bet ?? '',
    line: row.line ?? '', vig: row.vig ?? '', opponent: row.opponent ?? '', win: row.win ?? '',
    result: row.result ?? 'pending', note: row.note ?? '', is_active: row.is_active,
    min_tier: normalizeTier(row.min_tier), show_on_results: row.show_on_results, game_id: row.game_id ?? 'auto',
  }
}

/** Today in New York, as the card's date column writes it (YYYY-MM-DD). */
function todayNY(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

interface NotifyReport {
  skipped?: string
  discord?: { sent: number; mentioned: string | null } | { error: string }
  email?: { sent: number; failed: number } | { error: string }
  push?: { sent: number; pruned: number } | { error: string }
}

function notifySummary(n: NotifyReport | null | undefined): string {
  if (!n) return ''
  if (n.skipped) return ` Alerts skipped: ${n.skipped}.`
  const part = (name: string, r: any) =>
    !r ? null : 'error' in r ? `${name} failed` : 'mentioned' in r ? (r.sent ? `${name} posted` : `${name} off`) : `${name} ${r.sent}`
  const parts = [part('Discord', n.discord), part('email', n.email), part('push', n.push)].filter(Boolean)
  return parts.length ? ` Alerts: ${parts.join(', ')}.` : ''
}

function openEditor(kit: AdminKit, row?: TodaysBet) {
  kit.openPanel({
    title: row ? `Edit pick` : 'Post a pick',
    body: <PickEditor row={row} />,
  })
}

function PickEditor({ row }: { row?: TodaysBet }) {
  const kit = useAdminKit()!
  const router = useRouter()
  const [form, setForm] = useState<Form>(() => row ? formOf(row) : { ...EMPTY, date: todayNY() })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm(f => ({ ...f, [k]: v }))
    kit.setPanelDirty(true)
  }

  async function save() {
    if (!form.bet.trim()) { setError('The pick itself is required, e.g. "Chiefs -3.5".'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(row ? `/api/admin/todays-bets/${row.id}` : '/api/admin/todays-bets', {
        method: row ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error ?? 'Save failed')
      kit.setPanelDirty(false)
      kit.closePanel()
      kit.toast(row ? `Saved ${form.bet}` : `Posted ${form.bet}.${notifySummary(j.notified)}`)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const field = (k: 'date' | 'sport' | 'bet' | 'line' | 'vig' | 'opponent' | 'risk' | 'win', label: string, placeholder: string, hint?: string) => (
    <label className="akit-field">
      <span>{label}</span>
      <input value={form[k]} placeholder={placeholder} onChange={e => set(k, e.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  )

  return (
    <form className="akit-form" onSubmit={e => { e.preventDefault(); void save() }}>
      {error && <p className="akit-form__error" role="alert">{error}</p>}
      <div className="akit-grid">
        <label className="akit-field akit-field--full">
          <span>Pick</span>
          <input value={form.bet} placeholder="Chiefs -3.5" autoFocus onChange={e => set('bet', e.target.value)} />
        </label>
        {field('sport', 'Sport', 'NFL')}
        {field('date', 'Date', 'YYYY-MM-DD', 'The day the card shows it under')}
        {field('line', 'Line', '-3.5')}
        {field('vig', 'Closing line', '-4')}
        {field('opponent', 'Opponent', 'Broncos')}
        {field('risk', 'Units risked', '1.1', 'A loss costs this. Blank means 1.1.')}
        {field('win', 'Units to win', '1', 'A win pays this. Blank means 1.')}
        <label className="akit-field">
          <span>Who can see it</span>
          <select value={form.min_tier} onChange={e => set('min_tier', e.target.value as Tier)}>
            {PICK_ACCESS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <GameField form={form} set={set} />
        <label className="akit-field">
          <span>Result</span>
          <select value={form.result} onChange={e => set('result', e.target.value)}>
            <option value="pending">Pending</option>
            <option value="win">Win</option>
            <option value="loss">Loss</option>
            <option value="push">Push</option>
          </select>
        </label>
        <label className="akit-field akit-field--full">
          <span>Note</span>
          <input value={form.note} placeholder="Optional, shown under the pick" onChange={e => set('note', e.target.value)} />
        </label>
      </div>

      <div className="akit-switches">
        <label className="akit-switch">
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
          <span>On the card<small>Off hides it from the Portfolio card without deleting it.</small></span>
        </label>
        <label className="akit-switch">
          <input type="checkbox" checked={form.show_on_results} onChange={e => set('show_on_results', e.target.checked)} />
          <span>Counts on the public record<small>Graded picks with this on appear on the Results page.</small></span>
        </label>
      </div>

      {!row && <p className="akit-note">Posting sends the alerts (Discord, email, push) straight away to everyone who can see the pick.</p>}

      <div className="akit-form__foot">
        <div>
          {row && (
            <button type="button" className="akit-btn akit-btn--danger" onClick={() => void remove(kit, row, () => router.refresh())}>
              Delete
            </button>
          )}
        </div>
        <div>
          <button type="button" className="akit-btn" onClick={() => kit.closePanel()}>Cancel</button>
          <button type="submit" className="akit-btn akit-btn--primary" disabled={saving}>
            {saving ? 'Saving…' : row ? 'Save changes' : 'Post pick'}
          </button>
        </div>
      </div>
    </form>
  )
}

/** Which Desk game the pick belongs to. Same lookup the old form used. */
function GameField({ form, set }: { form: Form; set: <K extends keyof Form>(k: K, v: Form[K]) => void }) {
  const [games, setGames] = useState<{ id: string; label: string; kickoff: string | null }[]>([])
  const [suggested, setSuggested] = useState<string | null>(null)

  useEffect(() => {
    if (!form.sport || !form.date.trim()) { setGames([]); setSuggested(null); return }
    const ctl = new AbortController()
    const t = window.setTimeout(() => {
      const q = new URLSearchParams({ sport: form.sport, date: form.date, bet: form.bet, opponent: form.opponent })
      fetch(`/api/admin/pick-games?${q}`, { signal: ctl.signal })
        .then(r => r.json())
        .then(j => { setGames(j.games ?? []); setSuggested(j.suggested ?? null) })
        .catch(() => {})
    }, 300)
    return () => { window.clearTimeout(t); ctl.abort() }
  }, [form.sport, form.date, form.bet, form.opponent])

  const when = (iso: string | null) => iso
    ? new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
    : 'TBD'
  const suggestedLabel = games.find(g => g.id === suggested)?.label

  return (
    <label className="akit-field">
      <span>Desk game</span>
      <select value={form.game_id} onChange={e => set('game_id', e.target.value)}>
        <option value="auto">Auto-match{suggestedLabel ? ` (${suggestedLabel})` : ''}</option>
        <option value="">No game</option>
        {games.map(g => <option key={g.id} value={g.id}>{g.label} · {when(g.kickoff)}</option>)}
        {form.game_id && form.game_id !== 'auto' && !games.some(g => g.id === form.game_id) && (
          <option value={form.game_id}>Current game</option>
        )}
      </select>
    </label>
  )
}

// ── Panels: grading queue and all picks ─────────────────────────────────────

function sortNewest(a: TodaysBet, b: TodaysBet) {
  return (b.date ?? b.created_at).localeCompare(a.date ?? a.created_at)
}

function GradeQueue() {
  const rows = useRows()
  const pending = useMemo(
    () => [...rows.values()]
      .filter(r => String(r.result ?? 'pending').toLowerCase() === 'pending' && r.is_active !== false)
      .filter(r => (r.date ?? r.created_at.slice(0, 10)) <= todayNY())
      .sort(sortNewest),
    [rows],
  )
  if (pending.length === 0) return <p className="akit-empty">Nothing to grade. Every pick up to today has a result.</p>
  const today = todayNY()
  const groups = [
    { title: 'Earlier, still ungraded', rows: pending.filter(r => (r.date ?? r.created_at.slice(0, 10)) < today) },
    { title: 'Today, once the game is final', rows: pending.filter(r => (r.date ?? r.created_at.slice(0, 10)) === today) },
  ].filter(g => g.rows.length > 0)
  return (
    <>
      <p className="akit-note">W, L or P grades a pick and puts it on the public record. Click the same letter again to undo.</p>
      {groups.map(g => (
        <section key={g.title} className="akit-form">
          <h3 className="akit-group">{g.title} <span>{g.rows.length}</span></h3>
          <div className="akit-list">
            {g.rows.map(r => (
              <div key={r.id} className="akit-list__row">
                <div className="akit-list__main">
                  <b>{[r.bet, r.line].filter(Boolean).join(' ')}</b>
                  <span>{[r.sport, r.date, r.opponent ? `vs ${r.opponent}` : null].filter(Boolean).join(' · ')}</span>
                </div>
                <PickRowActions id={r.id} compact />
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function AllPicks() {
  const rows = useRows()
  const kit = useAdminKit()!
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.toLowerCase()
    return [...rows.values()]
      .filter(r => !s || [r.bet, r.sport, r.opponent, r.date].some(v => (v ?? '').toLowerCase().includes(s)))
      .sort(sortNewest)
      .slice(0, 200)
  }, [rows, q])
  return (
    <>
      <input className="akit-search" type="search" placeholder="Search team, sport or date…" value={q} onChange={e => setQ(e.target.value)} aria-label="Search picks" />
      <div className="akit-list">
        {list.map(r => (
          <div key={r.id} className="akit-list__row">
            <div className="akit-list__main">
              <b>{[r.bet, r.line].filter(Boolean).join(' ')}</b>
              <span>
                {[r.sport, r.date, GRADE_WORD[(String(r.result ?? 'pending').toLowerCase() as Grade)] ?? r.result,
                  r.is_active === false ? 'hidden from card' : null].filter(Boolean).join(' · ')}
              </span>
            </div>
            <button type="button" className="akit-btn" onClick={() => openEditor(kit, r)}>Edit</button>
          </div>
        ))}
        {list.length === 0 && <p className="akit-empty">No picks match.</p>}
      </div>
    </>
  )
}

/** Registers the page's picks and puts the pick actions in the admin bar. */
export function PicksAdmin({ rows }: { rows: TodaysBet[] }) {
  const kit = useAdminKit()
  useEffect(() => { setRows(rows) }, [rows])
  const toGrade = useMemo(
    () => rows.filter(r => String(r.result ?? 'pending').toLowerCase() === 'pending' && r.is_active !== false
      && (r.date ?? r.created_at.slice(0, 10)) <= todayNY()).length,
    [rows],
  )
  if (!kit) return null
  return (
    <AdminActions>
      <button type="button" className="akit-btn akit-btn--primary" onClick={() => openEditor(kit)}>+ Post pick</button>
      <button type="button" className="akit-btn" onClick={() => kit.openPanel({ title: 'Grade picks', body: <GradeQueue /> })}>
        Grade {toGrade > 0 && <span className="akit-btn__n">{toGrade}</span>}
      </button>
      <button type="button" className="akit-btn" onClick={() => kit.openPanel({ title: 'All picks', body: <AllPicks />, wide: true })}>
        All picks
      </button>
    </AdminActions>
  )
}
