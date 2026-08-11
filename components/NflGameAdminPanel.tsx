'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { IconPencil } from './Icons'

interface LinkableRow {
  id: string
  description: string
  sport: string
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
  allSystems: LinkableRow[]
  allTrends: LinkableRow[]
  linkedSystemIds: string[]
  linkedTrendIds: string[]
}

export default function NflGameAdminPanel({ game, allSystems, allTrends, linkedSystemIds, linkedTrendIds }: Props) {
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
        <label className="admin-form-label">Elite breakdown (members with the Season Pass only)</label>
        <div className="nfl-writeup-editor">
          <EditorContent editor={editor} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '14px' }}>
        <LinkPicker
          title={`Linked systems (${systemIds.size})`}
          rows={allSystems}
          selected={systemIds}
          onToggle={id => toggle(systemIds, id, setSystemIds)}
        />
        <LinkPicker
          title={`Linked trends (${trendIds.size})`}
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

function LinkPicker({ title, rows, selected, onToggle }: {
  title: string
  rows: LinkableRow[]
  selected: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div>
      <div className="admin-form-label" style={{ marginBottom: '6px' }}>{title}</div>
      <div className="nfl-link-picker">
        {rows.length === 0 && (
          <div style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            No NFL rows yet — add some on the systems/trends pages first.
          </div>
        )}
        {rows.map(row => (
          <label key={row.id} className="nfl-link-picker__row">
            <input
              type="checkbox"
              checked={selected.has(row.id)}
              onChange={() => onToggle(row.id)}
            />
            <span className="nfl-link-picker__desc">{row.description}</span>
            <span className="nfl-link-picker__record">{row.w ?? 0}-{row.l ?? 0}-{row.t ?? 0}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
