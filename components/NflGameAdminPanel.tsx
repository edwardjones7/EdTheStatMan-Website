'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { IconPencil } from './Icons'

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
  }
  sportLabel: string
  allSystems: LinkableRow[]
  allTrends: LinkableRow[]
  linkedSystemIds: string[]
  linkedTrendIds: string[]
}

export default function NflGameAdminPanel({ game, sportLabel, allSystems, allTrends, linkedSystemIds, linkedTrendIds }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [brief, setBrief] = useState(game.brief)
  const [isPublished, setIsPublished] = useState(game.is_published)
  const [systemIds, setSystemIds] = useState<Set<string>>(new Set(linkedSystemIds))
  const [trendIds, setTrendIds] = useState<Set<string>>(new Set(linkedTrendIds))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit],
    content: game.writeup_html || '<p></p>',
  })

  function toggle(set: Set<string>, id: string, apply: (next: Set<string>) => void) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    apply(next)
  }

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const patchRes = await fetch(`/api/admin/nfl-games/${game.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          writeup_html: editor?.getHTML() ?? game.writeup_html,
          is_published: isPublished,
        }),
      })
      if (!patchRes.ok) throw new Error((await patchRes.json()).error ?? 'Save failed')

      const linksRes = await fetch(`/api/admin/nfl-games/${game.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemIds: [...systemIds], trendIds: [...trendIds] }),
      })
      if (!linksRes.ok) throw new Error((await linksRes.json()).error ?? 'Saving links failed')

      setMessage('Saved.')
      router.refresh()
    } catch (e: any) {
      setMessage(e.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <div style={{ margin: '16px 0' }}>
        <button className="btn btn--outline btn--sm" onClick={() => setOpen(true)}>
          <IconPencil size={13} /> Edit game (admin)
        </button>
      </div>
    )
  }

  return (
    <div className="admin-inline-form" style={{ margin: '16px 0 28px' }}>
      <div className="admin-inline-form__title">Edit Game — Breakdown, Brief & Links</div>
      {message && <div style={{ marginBottom: '10px', fontSize: '0.85rem', color: message === 'Saved.' ? 'var(--accent-teal)' : '#ef4444' }}>{message}</div>}

      <div className="admin-form-field admin-form-field--wide" style={{ marginBottom: '14px' }}>
        <label className="admin-form-label">Brief (public teaser / SEO description)</label>
        <textarea
          className="admin-form-input"
          rows={2}
          value={brief}
          onChange={e => setBrief(e.target.value)}
          placeholder="One or two sentences everyone can read — sets up the matchup and feeds search results."
        />
      </div>

      <div className="admin-form-field admin-form-field--wide" style={{ marginBottom: '14px' }}>
        <label className="admin-form-label">Institutional breakdown (gated at the Institutional rung)</label>
        <div className="nfl-writeup-editor">
          <EditorContent editor={editor} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '14px' }}>
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

      <label className="admin-form-check" style={{ marginBottom: '14px' }}>
        <input type="checkbox" checked={isPublished} onChange={e => setIsPublished(e.target.checked)} />
        <span>Published (visible on the public hub)</span>
      </label>

      <div className="admin-inline-form__actions">
        <button className="btn btn--primary btn--sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button className="btn btn--outline btn--sm" onClick={() => setOpen(false)} disabled={saving}>
          Close
        </button>
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
