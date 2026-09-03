'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TIERS, TIER_SHORT_LABEL, type Tier } from '@/lib/access'

interface Props {
  sport: string
  season: number
  seasonType: number
  week: number
  weekLabel: string
  existing?: {
    title: string
    body_html: string
    min_tier: string
    is_published: boolean
  } | null
}

/**
 * The weekly desk note, edited in place on the board.
 *
 * Same pattern as HomeEditor / ModelPicksEditor: the admin edits the live page
 * rather than a separate CMS screen. TipTap is already a dependency (the blog
 * editor uses it), so this adds no new packages.
 */
export default function DeskNoteEditor({
  sport, season, seasonType, week, weekLabel, existing,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(existing?.title ?? '')
  const [minTier, setMinTier] = useState<Tier>((existing?.min_tier as Tier) ?? 'desk')
  const [published, setPublished] = useState(existing?.is_published ?? false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const editor = useEditor({
    extensions: [StarterKit],
    content: existing?.body_html || '<p></p>',
    immediatelyRender: false,
    editorProps: { attributes: { class: 'desk-note-editor__body' } },
  })

  async function save() {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/desk-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport, season, season_type: seasonType, week,
          title,
          body_html: editor?.getHTML() ?? '',
          min_tier: minTier,
          is_published: published,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Save failed')
      setMessage(published ? 'Published' : 'Saved as draft')
      router.refresh()
    } catch (e: any) {
      setMessage(e.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button className="desk-note-open" onClick={() => setOpen(true)}>
        {existing ? 'Edit desk note' : 'Write the desk note'} — {weekLabel}
        {existing && !existing.is_published && <span className="desk-note-open__draft">draft</span>}
      </button>
    )
  }

  return (
    <div className="desk-note-editor">
      <div className="desk-note-editor__head">
        <span className="desk-note__label">Desk Note — {weekLabel}</span>
        <button className="analyst-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
      </div>

      <input
        className="desk-note-editor__title"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="What we're watching this week"
        maxLength={200}
      />

      <div className="desk-note-editor__toolbar">
        <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()}><b>B</b></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()}><i>I</i></button>
        <button type="button" onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()}>• List</button>
        <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()}>&ldquo;</button>
      </div>

      <EditorContent editor={editor} />

      <div className="desk-note-editor__foot">
        <label className="desk-note-editor__field">
          Visible to
          <select value={minTier} onChange={e => setMinTier(e.target.value as Tier)}>
            {TIERS.map(t => (
              <option key={t} value={t}>
                {TIER_SHORT_LABEL[t]}{t === 'retail' ? ' (everyone)' : ' and above'}
              </option>
            ))}
          </select>
        </label>

        <label className="desk-note-editor__check">
          <input
            type="checkbox"
            checked={published}
            onChange={e => setPublished(e.target.checked)}
          />
          Published
        </label>

        <button className="btn btn--primary btn--sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>

        {message && <span className="desk-note-editor__msg">{message}</span>}
      </div>
    </div>
  )
}
