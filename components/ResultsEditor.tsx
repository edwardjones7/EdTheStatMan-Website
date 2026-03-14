'use client'

import { useState } from 'react'
import type { ResultsContent } from '@/lib/site-content'
import ResultsPage from './ResultsPage'
import CTASection from './CTASection'

interface Props {
  content: ResultsContent
}

export default function ResultsEditor({ content }: Props) {
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<ResultsContent>(content)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)

  function patch(updates: Partial<ResultsContent>) {
    setDraft(prev => ({ ...prev, ...updates }))
    setDirty(true)
  }

  function cancel() {
    setDraft(content)
    setDirty(false)
    setError(null)
    setResetKey(k => k + 1)
    setEditMode(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const r = await fetch('/api/admin/content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'results', value: draft }),
      })
      if (!r.ok) {
        const j = await r.json()
        throw j.error ?? 'Save failed'
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
      <ResultsPage
        content={draft}
        editMode={editMode}
        onEdit={patch}
        resetKey={resetKey}
      />
      <CTASection />

      {/* Pencil FAB */}
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
            title="Edit page content"
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
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
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
