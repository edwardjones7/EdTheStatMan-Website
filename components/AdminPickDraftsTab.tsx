'use client'

import { useCallback, useEffect, useState } from 'react'
import { PICK_ACCESS_OPTIONS } from '@/lib/access'
import type { Market, ParsedPick } from '@/lib/picks/parse'
import type { PickDraft, DraftStatus } from '@/lib/picks/drafts'
import '@/styles/picks.css'

/**
 * The pick queue: Ed's X posts, parsed, waiting for one tap.
 *
 * Built for a phone first, because that is where Ed is when he posts. Each
 * draft is a card: the original post, the parsed picks as editable fields,
 * then Approve or Reject. Approving publishes exactly what the fields say, so
 * a wrong parse is corrected in place, never after the fact.
 *
 * The paste box is always there. It is how the engine works before X keys are
 * set, and how a post the ingest missed gets in.
 */

const MARKET_OPTIONS: Market[] = ['spread', 'total', 'moneyline', 'prop', 'other']
const FILTERS: { value: DraftStatus; label: string }[] = [
  { value: 'pending', label: 'Queue' },
  { value: 'skipped', label: 'No pick found' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

interface QueueConfig { x: boolean; ai: boolean; model: string; migrated: boolean }
interface QueueData { config: QueueConfig | null; drafts: PickDraft[]; counts: Record<string, number>; error?: string }

/** Editable shape: odds as text so "-110" can be typed a character at a time. */
type EditPick = Omit<ParsedPick, 'odds'> & { odds: string }

const toEdit = (p: ParsedPick): EditPick => ({ ...p, odds: p.odds == null ? '' : p.odds > 0 ? `+${p.odds}` : String(p.odds) })
const blankPick = (sport: string | null): EditPick => ({
  sport, bet: '', opponent: null, line: null, odds: '', market: 'spread', isProp: false, playerName: null,
})
const fromEdit = (p: EditPick) => ({ ...p, odds: p.odds.trim() || null, isProp: p.market === 'prop' })

function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  }) + ' ET'
}

export default function AdminPickDraftsTab() {
  const [status, setStatus] = useState<DraftStatus>('pending')
  const [data, setData] = useState<QueueData>({ config: null, drafts: [], counts: {} })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error' | 'warn'; text: string } | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [pasteUrl, setPasteUrl] = useState('')
  const [pasting, setPasting] = useState(false)
  const [pulling, setPulling] = useState(false)

  const load = useCallback(async (which: DraftStatus) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/pick-drafts?status=${which}`, { cache: 'no-store' })
      const json = await res.json()
      setData({ config: json.config ?? null, drafts: json.drafts ?? [], counts: json.counts ?? {}, error: json.error })
    } catch (e: any) {
      setData(d => ({ ...d, error: e?.message ?? 'Could not load the queue' }))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(status) }, [status, load])

  async function paste() {
    if (!pasteText.trim()) return
    setPasting(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/pick-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText, url: pasteUrl || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not queue the post')
      const n = json.draft?.parsed?.picks?.length ?? 0
      setMessage(json.duplicate
        ? { kind: 'warn', text: 'That post is already in the queue.' }
        : { kind: 'ok', text: n ? `Queued with ${n} pick${n === 1 ? '' : 's'} found.` : 'Queued, but no pick was found in it. It is under "No pick found".' })
      setPasteText('')
      setPasteUrl('')
      if (status === 'pending') load('pending')
      else setStatus('pending')
    } catch (e: any) {
      setMessage({ kind: 'error', text: e.message })
    } finally {
      setPasting(false)
    }
  }

  async function pull() {
    setPulling(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/pick-drafts/ingest', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || json.ok === false) throw new Error(json.skipped ?? json.error ?? 'Pull failed')
      if (json.skipped) setMessage({ kind: 'warn', text: json.skipped })
      else setMessage({
        kind: 'ok',
        text: `Fetched ${json.fetched} post${json.fetched === 1 ? '' : 's'}: ${json.queued} queued, ${json.noPick} with no pick, ${json.duplicates} already in.` +
          (json.errors?.length ? ` ${json.errors.length} failed.` : ''),
      })
      load(status)
    } catch (e: any) {
      setMessage({ kind: 'error', text: e.message })
    } finally {
      setPulling(false)
    }
  }

  const removeDraft = (id: string) =>
    setData(d => ({ ...d, drafts: d.drafts.filter(x => x.id !== id) }))

  const cfg = data.config

  return (
    <div className="admin-section pd">
      {cfg && !cfg.migrated && (
        <div className="pd-status pd-status--error">
          The queue needs <code>supabase/migrations/picks_01_engine.sql</code> applied. Until then nothing can be queued or approved.
        </div>
      )}
      {cfg && cfg.migrated && (
        <div className={`pd-status ${cfg.x ? 'pd-status--ok' : 'pd-status--warn'}`}>
          {cfg.x
            ? 'X is connected: new posts are pulled on the cron schedule, or now with the button.'
            : 'X not configured (set X_BEARER_TOKEN and X_USER_ID). Paste posts below in the meantime.'}
          {' '}
          {cfg.ai ? `Parser: ${cfg.model}.` : 'Parser: built-in rules (no AI_GATEWAY_API_KEY), so check each parse.'}
        </div>
      )}
      {message && <div className={`pd-status pd-status--${message.kind}`}>{message.text}</div>}

      <div className="pd-paste">
        <h3>Paste a post</h3>
        <textarea
          className="pd-textarea"
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder={'Chiefs -3.5 -110\nMahomes o2.5 pass TD -130'}
        />
        <label className="pd-label" htmlFor="pd-paste-url">Link to the post (optional)</label>
        <input
          id="pd-paste-url"
          className="pd-input"
          value={pasteUrl}
          onChange={e => setPasteUrl(e.target.value)}
          placeholder="https://x.com/…/status/…"
          inputMode="url"
        />
        <div className="pd-actions">
          <button className="btn btn--primary" onClick={paste} disabled={pasting || !pasteText.trim() || cfg?.migrated === false}>
            {pasting ? 'Parsing…' : 'Parse and queue'}
          </button>
          {cfg?.x && (
            <button className="btn btn--outline" onClick={pull} disabled={pulling}>
              {pulling ? 'Pulling…' : 'Pull from X now'}
            </button>
          )}
        </div>
      </div>

      <div className="pd-toolbar" role="tablist" aria-label="Draft status">
        {FILTERS.map(f => (
          <button
            key={f.value}
            role="tab"
            aria-selected={status === f.value}
            className={`pd-filter ${status === f.value ? 'pd-filter--active' : ''}`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}{data.counts[f.value] ? ` (${data.counts[f.value]})` : ''}
          </button>
        ))}
        <span className="pd-toolbar__spacer" />
        <button className="pd-link" onClick={() => load(status)} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
      </div>

      {data.error && cfg?.migrated !== false && <div className="pd-status pd-status--error">{data.error}</div>}
      {!loading && data.drafts.length === 0 && !data.error && (
        <p className="text-muted">{status === 'pending' ? 'Nothing waiting. New posts land here.' : 'Nothing here.'}</p>
      )}

      {data.drafts.map(d => (
        <DraftCard key={d.id} draft={d} onGone={() => removeDraft(d.id)} />
      ))}
    </div>
  )
}

function DraftCard({ draft, onGone }: { draft: PickDraft; onGone: () => void }) {
  const firstSport = draft.parsed?.picks?.[0]?.sport ?? null
  const [picks, setPicks] = useState<EditPick[]>(
    (draft.parsed?.picks ?? []).length ? draft.parsed.picks.map(toEdit) : [blankPick(null)]
  )
  // The blurb defaults to the post itself: it is already public on X, and it
  // is usually the reasoning. Ed can trim it or clear it.
  const [note, setNote] = useState<string>(draft.parsed?.note ?? draft.post_text)
  const [tier, setTier] = useState('retail')
  const [notify, setNotify] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [published, setPublished] = useState<{ slug: string | null; id: string; bet: string }[] | null>(null)

  const editable = draft.status !== 'approved' && !published

  const setPick = (i: number, patch: Partial<EditPick>) =>
    setPicks(ps => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  async function call(action: string, url: string, body?: unknown, method = 'POST') {
    setBusy(action)
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? `${action} failed`)
      return json
    } catch (e: any) {
      setError(e.message)
      return null
    } finally {
      setBusy(null)
    }
  }

  async function approve() {
    const json = await call('Approve', `/api/admin/pick-drafts/${draft.id}/approve`, {
      picks: picks.map(fromEdit), note: note.trim() || null, min_tier: tier, notify,
    })
    if (json) setPublished((json.picks ?? []).map((p: any) => ({ slug: p.slug, id: p.id, bet: p.bet })))
  }

  async function reject() {
    if (await call('Reject', `/api/admin/pick-drafts/${draft.id}/reject`)) onGone()
  }

  async function save(extra?: Record<string, unknown>) {
    const json = await call('Save', `/api/admin/pick-drafts/${draft.id}`, {
      picks: picks.map(fromEdit), note: note.trim() || null, ...extra,
    }, 'PATCH')
    return json
  }

  async function reparse() {
    const json = await call('Re-parse', `/api/admin/pick-drafts/${draft.id}`, { reparse: true }, 'PATCH')
    if (json?.draft) {
      const ps: ParsedPick[] = json.draft.parsed?.picks ?? []
      setPicks(ps.length ? ps.map(toEdit) : [blankPick(firstSport)])
    }
  }

  const parserLine = draft.parsed?.parser === 'ai'
    ? `Parsed by ${draft.parsed.model ?? 'AI'}`
    : `Parsed by rules${draft.parsed?.error ? ` (${draft.parsed.error})` : ''}`

  return (
    <div className="pd-card">
      <div className="pd-post-meta">
        <span>{fmtWhen(draft.posted_at)}</span>
        {draft.post_url && <a href={draft.post_url} target="_blank" rel="noopener noreferrer">Open on X</a>}
        <span>{parserLine}</span>
      </div>
      <div className="pd-post">{draft.post_text}</div>

      {published ? (
        <div className="pd-done">
          Published {published.length} pick{published.length === 1 ? '' : 's'}:{' '}
          {published.map((p, i) => (
            <span key={p.id}>
              {i > 0 && ', '}
              <a href={`/picks/${p.slug ?? p.id}`} target="_blank" rel="noopener noreferrer">{p.bet}</a>
            </span>
          ))}
        </div>
      ) : draft.status === 'approved' ? (
        <div className="pd-done">
          Approved {draft.reviewed_at ? fmtWhen(draft.reviewed_at) : ''}.{' '}
          {(draft.pick_ids ?? []).map((id, i) => (
            <span key={id}>{i > 0 && ', '}<a href={`/picks/${id}`} target="_blank" rel="noopener noreferrer">pick {i + 1}</a></span>
          ))}
        </div>
      ) : (
        <>
          {picks.map((p, i) => (
            <div className="pd-pick" key={i}>
              <div className="pd-pick__grid">
                <div className="pd-pick__wide">
                  <label className="pd-label">Pick</label>
                  <input className="pd-input" value={p.bet} onChange={e => setPick(i, { bet: e.target.value })} placeholder="Chiefs -3.5" />
                </div>
                <div>
                  <label className="pd-label">Sport</label>
                  <input className="pd-input" value={p.sport ?? ''} onChange={e => setPick(i, { sport: e.target.value.toUpperCase() || null })} placeholder="NFL" />
                </div>
                <div>
                  <label className="pd-label">Odds</label>
                  <input className="pd-input" value={p.odds} onChange={e => setPick(i, { odds: e.target.value })} placeholder="-110" inputMode="numeric" />
                </div>
                <div>
                  <label className="pd-label">Market</label>
                  <select className="pd-select" value={p.market} onChange={e => setPick(i, { market: e.target.value as Market })}>
                    {MARKET_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="pd-label">Opponent</label>
                  <input className="pd-input" value={p.opponent ?? ''} onChange={e => setPick(i, { opponent: e.target.value || null })} placeholder="Broncos" />
                </div>
                {p.market === 'prop' && (
                  <div className="pd-pick__wide">
                    <label className="pd-label">Player</label>
                    <input className="pd-input" value={p.playerName ?? ''} onChange={e => setPick(i, { playerName: e.target.value || null })} />
                  </div>
                )}
              </div>
              {picks.length > 1 && (
                <button className="pd-pick__remove" onClick={() => setPicks(ps => ps.filter((_, j) => j !== i))}>Remove this pick</button>
              )}
            </div>
          ))}
          <div className="pd-actions">
            <button className="pd-link" onClick={() => setPicks(ps => [...ps, blankPick(ps[0]?.sport ?? firstSport)])}>+ Add a pick</button>
            <button className="pd-link" onClick={reparse} disabled={!!busy}>Re-parse</button>
            <button className="pd-link" onClick={() => save()} disabled={!!busy}>{busy === 'Save' ? 'Saving…' : 'Save edits'}</button>
          </div>

          <label className="pd-label">Ed&apos;s blurb (shown on the pick page)</label>
          <textarea className="pd-textarea" value={note} onChange={e => setNote(e.target.value)} />

          <div className="pd-pick__grid">
            <div>
              <label className="pd-label">Access</label>
              <select className="pd-select" value={tier} onChange={e => setTier(e.target.value)}>
                {PICK_ACCESS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="pd-actions">
            {editable && (
              <>
                <button className="btn btn--primary" onClick={approve} disabled={!!busy || picks.every(p => !p.bet.trim())}>
                  {busy === 'Approve' ? 'Publishing…' : `Approve ${picks.filter(p => p.bet.trim()).length > 1 ? `${picks.filter(p => p.bet.trim()).length} picks` : ''}`.trim()}
                </button>
                {draft.status === 'pending'
                  ? <button className="btn btn--outline" onClick={reject} disabled={!!busy}>Reject</button>
                  : <button className="btn btn--outline" onClick={async () => { if (await save({ status: 'pending' })) onGone() }} disabled={!!busy}>Move to queue</button>}
              </>
            )}
            <label className="pd-check">
              <input type="checkbox" checked={notify} onChange={e => setNotify(e.target.checked)} />
              Announce (Discord, email, push)
            </label>
          </div>
        </>
      )}
      {error && <p className="pd-error">{error}</p>}
    </div>
  )
}
