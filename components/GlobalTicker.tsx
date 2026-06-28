'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import LiveTicker from './LiveTicker'
import type { TickerContent } from '@/lib/site-content'

interface Props {
  content: TickerContent
  isAdmin: boolean
}

/**
 * The single, global ticker rendered by the root layout on every route.
 * For admins it is editable in place from any page — edits save to the
 * `ticker` site_content key and the page re-renders via router.refresh()
 * (no full reload, so scroll position and React state are preserved).
 */
export default function GlobalTicker({ content, isAdmin }: Props) {
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<TickerContent>(content)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When the server sends fresh content (e.g. after router.refresh()), resync
  // the draft. While editing, `content` keeps the same reference (the layout
  // does not re-render on client navigation), so this never clobbers edits.
  useEffect(() => {
    if (!editMode) {
      setDraft(content)
      setDirty(false)
    }
  }, [content, editMode])

  if (!isAdmin) {
    return <LiveTicker content={content} />
  }

  function patch(updates: Partial<TickerContent>) {
    setDraft(prev => ({ ...prev, ...updates }))
    setDirty(true)
  }

  function cancel() {
    setDraft(content)
    setDirty(false)
    setError(null)
    setEditMode(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ticker', value: draft }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Save failed')
      }
      setDirty(false)
      setEditMode(false)
      router.refresh()
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (editMode) {
    return (
      <LiveTicker
        content={draft}
        editMode
        onEdit={patch}
        onSave={save}
        onCancel={cancel}
        saving={saving}
        dirty={dirty}
        error={error}
      />
    )
  }

  return (
    <>
      <LiveTicker content={content} />
      <button
        onClick={() => { setDraft(content); setDirty(false); setError(null); setEditMode(true) }}
        title="Edit ticker"
        style={{
          position: 'fixed',
          top: 'calc(var(--nav-height) + 6px)',
          right: '14px',
          zIndex: 1000,
          background: 'rgba(52,211,153,0.12)',
          color: 'var(--accent-green)',
          border: '1px solid rgba(52,211,153,0.35)',
          borderRadius: '6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '0.7rem',
          fontWeight: 700,
          padding: '3px 9px',
          letterSpacing: '0.03em',
          lineHeight: 1.4,
        }}
      >
        ✏ Ticker
      </button>
    </>
  )
}
