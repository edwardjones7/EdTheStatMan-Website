'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { IconPencil } from './Icons'
import { AdminActions, useAdminKit } from './admin-kit/AdminKit'
import { writeupBetCount } from '@/lib/nfl'

interface LinkableRow {
  id: string
  code?: string | null
  description: string
  sport: string
  team?: string | null
  w: number | null
  l: number | null
  t: number | null
}

interface Props {
  game: {
    id: string
    brief: string
    writeup_html: string
    is_published: boolean
    /** When the Desk rung's in-context view was shut. null = still open. */
    research_closed_at: string | null
  }
  sportLabel: string
  allSystems: LinkableRow[]
  allTrends: LinkableRow[]
  linkedSystemIds: string[]
  linkedTrendIds: string[]
}

/**
 * "Edit game" in the admin bar; the editor opens in the wide side panel, so
 * the page stays exactly as visitors see it.
 */
export default function NflGameAdminPanel(props: Props) {
  const kit = useAdminKit()
  if (!kit) return null
  const linked = props.linkedSystemIds.length + props.linkedTrendIds.length
  return (
    <AdminActions>
      <button
        type="button"
        className="akit-btn akit-btn--primary"
        onClick={() => kit.openPanel({ title: 'Edit game research', body: <GameEditor {...props} />, wide: true })}
      >
        <IconPencil size={13} /> Edit game
      </button>
      <span className="akit-bar__meta">
        {props.game.is_published ? 'Published' : 'Hidden from visitors'} · {linked} linked
      </span>
    </AdminActions>
  )
}

function GameEditor({ game, sportLabel, allSystems, allTrends, linkedSystemIds, linkedTrendIds }: Props) {
  const router = useRouter()
  const kit = useAdminKit()!
  const [brief, setBriefRaw] = useState(game.brief)
  const [isPublished, setIsPublished] = useState(game.is_published)
  const [researchClosed, setResearchClosed] = useState(Boolean(game.research_closed_at))
  const [systemIds, setSystemIds] = useState<Set<string>>(new Set(linkedSystemIds))
  const [trendIds, setTrendIds] = useState<Set<string>>(new Set(linkedTrendIds))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [betCount, setBetCount] = useState(() => writeupBetCount(game.writeup_html))
  const dirty = () => kit.setPanelDirty(true)
  const setBrief = (v: string) => { setBriefRaw(v); dirty() }

  const closedOn = game.research_closed_at
    ? new Date(game.research_closed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: game.writeup_html || '<p></p>',
    onUpdate: ({ editor }) => { setBetCount(writeupBetCount(editor.getHTML())); dirty() },
  })

  function toggle(set: Set<string>, id: string, apply: (next: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    apply(next)
    dirty()
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const patchRes = await fetch(`/api/admin/nfl-games/${game.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          writeup_html: editor?.getHTML() ?? game.writeup_html,
          is_published: isPublished,
          research_closed: researchClosed,
        }),
      })
      if (!patchRes.ok) throw new Error((await patchRes.json()).error ?? 'Save failed')

      const linksRes = await fetch(`/api/admin/nfl-games/${game.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemIds: [...systemIds], trendIds: [...trendIds] }),
      })
      if (!linksRes.ok) throw new Error((await linksRes.json()).error ?? 'Saving links failed')

      kit.setPanelDirty(false)
      kit.closePanel()
      kit.toast('Game research saved')
      router.refresh()
    } catch (e: any) {
      setError(e.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="akit-form">
      {error && <p className="akit-form__error" role="alert">{error}</p>}

      <div className="admin-form-field admin-form-field--wide">
        <label className="admin-form-label">Brief (everyone can read it; also the search description)</label>
        <textarea
          className="admin-form-input"
          rows={2}
          value={brief}
          onChange={e => setBrief(e.target.value)}
          placeholder="One or two sentences everyone can read — sets up the matchup and feeds search results."
        />
      </div>

      <div className="admin-form-field admin-form-field--wide">
        <label className="admin-form-label">Breakdown (Vault and Research Desk members)</label>
        <div className="nfl-writeup-editor">
          <EditorContent editor={editor} />
        </div>
        <p className="admin-form-hint">
          Counted on the board: {betCount} {betCount === 1 ? 'bet' : 'bets'}. One bet per line, like
          &ldquo;OVER Zay Flowers 48.5 receiving yards&rdquo; or &ldquo;Ravens +9.5&rdquo;. Leans are not counted.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        <LinkPicker
          title={`Linked systems (${systemIds.size})`}
          kind="systems"
          sportLabel={sportLabel}
          rows={allSystems}
          selected={systemIds}
          onToggle={id => toggle(systemIds, id, setSystemIds)}
        />
        <LinkPicker
          title={`Linked trends (${trendIds.size})`}
          kind="trends"
          sportLabel={sportLabel}
          rows={allTrends}
          selected={trendIds}
          onToggle={id => toggle(trendIds, id, setTrendIds)}
        />
      </div>

      <div className="akit-switches">
        <label className="akit-switch">
          <input type="checkbox" checked={isPublished} onChange={e => { setIsPublished(e.target.checked); dirty() }} />
          <span>Published<small>Off hides this game from visitors; admins still see it.</small></span>
        </label>
        {/* Kept for the record, but it changes nothing today: closing only
            ever shut linked rows to Desk members WITHOUT the Vault library,
            and since Nov 2026 every Research Desk pass includes the Vault. */}
        <label className="akit-switch">
          <input type="checkbox" checked={researchClosed} onChange={e => { setResearchClosed(e.target.checked); dirty() }} />
          <span>
            Research closed{researchClosed && closedOn ? ` (since ${closedOn})` : ''}
            <small>No effect on current plans: every Research Desk member also holds the Vault, so they keep the linked rows either way.</small>
          </span>
        </label>
      </div>

      <div className="akit-form__foot">
        <div />
        <div>
          <button type="button" className="akit-btn" onClick={() => kit.closePanel()} disabled={saving}>Cancel</button>
          <button type="button" className="akit-btn akit-btn--primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save game'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Search normalises to letters and digits only, on both sides. That is what
// makes a code searchable the way it is actually remembered: "nfls 6",
// "NFLS-0006" and "nfls0006" all reduce to the same needle, and a bare "0006"
// still finds it. Words are matched independently, so "bills dogs" works too.
function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function LinkPicker({ title, kind, sportLabel, rows, selected, onToggle }: {
  title: string
  kind: 'systems' | 'trends'
  sportLabel: string
  rows: LinkableRow[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)

  // Haystacks are built once per row list, not once per keystroke.
  const haystacks = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of rows) {
      map.set(row.id, squash([row.code ?? '', row.team ?? '', row.description ?? ''].join(' ')))
    }
    return map
  }, [rows])

  const terms = query.trim().split(/\s+/).map(squash).filter(Boolean)
  const visible = rows.filter(row => {
    if (selectedOnly && !selected.has(row.id)) return false
    if (!terms.length) return true
    const hay = haystacks.get(row.id) ?? ''
    return terms.every(term => hay.includes(term))
  })

  return (
    <div>
      <div className="admin-form-label" style={{ marginBottom: '6px' }}>{title}</div>

      <div className="nfl-link-picker__search">
        <input
          type="search"
          className="admin-form-input"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={kind === 'systems' ? 'Search by ID or text — e.g. NFLS0006' : 'Search by ID, team or text — e.g. NFLT0018'}
          aria-label={`Search ${kind} by ID or text`}
        />
      </div>

      <div className="nfl-link-picker__meta">
        <span>
          {visible.length === rows.length
            ? `${rows.length} ${sportLabel} ${kind}`
            : `${visible.length} of ${rows.length} ${sportLabel} ${kind}`}
        </span>
        <label className="nfl-link-picker__only">
          <input type="checkbox" checked={selectedOnly} onChange={e => setSelectedOnly(e.target.checked)} />
          <span>Linked only</span>
        </label>
      </div>

      <div className="nfl-link-picker">
        {rows.length === 0 && (
          <div className="nfl-link-picker__empty">
            No {sportLabel} {kind} in the Vault yet — add some on the {kind} page first.
          </div>
        )}
        {rows.length > 0 && visible.length === 0 && (
          <div className="nfl-link-picker__empty">
            {selectedOnly && !terms.length
              ? `Nothing linked yet.`
              : `No ${sportLabel} ${kind} match "${query.trim()}".`}
          </div>
        )}
        {visible.map(row => (
          <label key={row.id} className="nfl-link-picker__row">
            <input
              type="checkbox"
              checked={selected.has(row.id)}
              onChange={() => onToggle(row.id)}
            />
            {row.code && <span className="nfl-link-picker__code">{row.code}</span>}
            <span className="nfl-link-picker__desc">{row.description}</span>
            <span className="nfl-link-picker__record">{row.w ?? 0}-{row.l ?? 0}-{row.t ?? 0}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
