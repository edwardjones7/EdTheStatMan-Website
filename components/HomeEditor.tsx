'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AllSiteContent } from '@/lib/site-content'
import LiveTicker from './LiveTicker'
import Hero from './Hero'
import ActionCard from './ActionCard'
import SystemsOverview from './SystemsOverview'
import Features from './Features'
import StatBotPreview from './StatBotPreview'
import CTASection from './CTASection'

interface Props {
  content: AllSiteContent
}

export default function HomeEditor({ content }: Props) {
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<AllSiteContent>(content)
  const [dirty, setDirty] = useState(false)
  const [dirtyKeys, setDirtyKeys] = useState(new Set<keyof AllSiteContent>())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const router = useRouter()

  function patch<K extends keyof AllSiteContent>(section: K, updates: Partial<AllSiteContent[K]>) {
    setDraft(prev => ({ ...prev, [section]: { ...prev[section], ...updates } }))
    setDirty(true)
    setDirtyKeys(prev => new Set([...prev, section]))
  }

  function toggleEdit() {
    if (editMode && dirty) {
      // Discard on toggle-off if dirty — prompt handled by the UI
      cancel()
    } else {
      setEditMode(e => !e)
    }
  }

  function cancel() {
    setDraft(content)
    setDirty(false)
    setDirtyKeys(new Set())
    setError(null)
    setResetKey(k => k + 1)
    setEditMode(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await Promise.all(
        [...dirtyKeys].map(key =>
          fetch('/api/admin/content', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: draft[key] }),
          }).then(r => r.ok ? r.json() : r.json().then(j => Promise.reject(j.error)))
        )
      )
      setDirty(false)
      setDirtyKeys(new Set())
      setEditMode(false)
      router.refresh()
      // Re-run counter/bar animations after server data refreshes
      setTimeout(() => window.dispatchEvent(new Event('reinit-animations')), 300)
    } catch (e: any) {
      setError(typeof e === 'string' ? e : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const ep = (section: keyof AllSiteContent) => ({
    editMode,
    onEdit: (updates: any) => patch(section, updates),
    resetKey,
  })

  return (
    <>
      <LiveTicker     content={draft.ticker}            editMode={editMode} onEdit={u => patch('ticker', u)} />
      <Hero           content={draft.hero}             {...ep('hero')} />
      <ActionCard     content={draft.action_card}       {...ep('action_card')} />
      <SystemsOverview content={draft.systems_overview} {...ep('systems_overview')} />
      <Features       content={draft.features}          {...ep('features')} />
      {/* <StatBotPreview content={draft.statbot_preview}   {...ep('statbot_preview')} /> */}
      <CTASection     content={draft.cta_section}       {...ep('cta_section')} />

      {/* ── Single global FAB ── */}
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
