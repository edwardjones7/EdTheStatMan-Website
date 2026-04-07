'use client'

import { useState } from 'react'
import TodaysBets from './TodaysBets'
import type { TodaysBet } from './TodaysBets'
import type { ModelPicksContent } from '@/lib/site-content'

interface Props {
  rows: TodaysBet[]
  userTier: string | null
  headerContent: ModelPicksContent
}

export default function ModelPicksEditor({ rows, userTier, headerContent }: Props) {
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<ModelPicksContent>(headerContent)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)

  function onHeaderEdit(updates: Partial<ModelPicksContent>) {
    setDraft(prev => ({ ...prev, ...updates }))
    setDirty(true)
  }

  function cancel() {
    setDraft(headerContent)
    setDirty(false)
    setError(null)
    setResetKey(k => k + 1)
    setEditMode(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'model_picks', value: draft }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw j.error || 'Save failed'
      }
      window.location.href = window.location.pathname
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <TodaysBets
        rows={rows}
        isAdmin={true}
        userTier={userTier}
        editMode={editMode}
        headerContent={draft}
        onHeaderEdit={onHeaderEdit}
        resetKey={resetKey}
      />

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
          <>
            {dirty && (
              <button
                onClick={save}
                disabled={saving}
                title="Save all changes"
                style={{ ...fab, background: 'var(--accent-green)', color: '#000' }}
              >
                {saving ? '…' : '✓'}
              </button>
            )}
            <button
              onClick={cancel}
              title="Exit edit mode"
              style={{
                ...fab,
                width: dirty ? '40px' : '54px',
                height: dirty ? '40px' : '54px',
                fontSize: dirty ? '1rem' : '1.3rem',
                background: dirty ? 'var(--bg-secondary)' : 'rgba(52,211,153,0.15)',
                color: dirty ? 'var(--text-muted)' : 'var(--accent-green)',
                border: dirty ? '2px solid var(--border)' : '2px solid rgba(52,211,153,0.35)',
              }}
            >
              ✕
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            title="Edit picks"
            style={{ ...fab, background: 'var(--accent-green)', color: '#000' }}
          >
            ✏
          </button>
        )}

        {error && (
          <span style={{
            background: 'rgba(239,68,68,0.92)',
            color: '#fff',
            fontSize: '0.72rem',
            padding: '5px 9px',
            borderRadius: '6px',
            maxWidth: '150px',
            textAlign: 'center',
            lineHeight: 1.4,
          }}>
            {error}
          </span>
        )}

        {editMode && !dirty && (
          <span style={{
            background: 'rgba(52,211,153,0.12)',
            border: '1px solid rgba(52,211,153,0.25)',
            color: 'var(--accent-green)',
            fontSize: '0.68rem',
            fontWeight: 600,
            padding: '3px 8px',
            borderRadius: '6px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            whiteSpace: 'nowrap' as const,
          }}>
            Editing
          </span>
        )}
      </div>
    </>
  )
}

const fab: React.CSSProperties = {
  width: '54px',
  height: '54px',
  borderRadius: '50%',
  border: 'none',
  cursor: 'pointer',
  fontSize: '1.3rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  transition: 'transform 0.15s',
}
