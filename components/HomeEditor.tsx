'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { AllSiteContent } from '@/lib/site-content'
import Features from './Features'
import CTASection from './CTASection'
import { AdminActions, useAdminKit } from './admin-kit/AdminKit'

interface Props {
  /**
   * Today's Brief, already rendered on the server. Passed as a node rather than
   * imported here because this is a client component and the brief is a server
   * component holding entitlement-filtered rows — importing it would drag that
   * gating into the browser bundle.
   */
  brief?: ReactNode
  /**
   * The hero and the record strip under it (HomeHero + HomeRecord), rendered
   * on the server for the same reason as the brief. Neither reads
   * site_content: the hero's words and the board are fixed and live, so the
   * old editable hero copy and hand-typed stat bar are no longer shown.
   */
  hero?: ReactNode
  content: AllSiteContent
}

/**
 * The homepage, with its two text sections (Features and the closing call to
 * action) editable by admins. "Edit page text" in the admin bar outlines them
 * and scrolls there; Save writes only the sections that changed.
 */
export default function HomeEditor({ content, brief, hero }: Props) {
  const kit = useAdminKit()
  const router = useRouter()
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState<AllSiteContent>(content)
  const [dirtyKeys, setDirtyKeys] = useState(new Set<keyof AllSiteContent>())
  const [saving, setSaving] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const dirty = dirtyKeys.size > 0

  function patch<K extends keyof AllSiteContent>(section: K, updates: Partial<AllSiteContent[K]>) {
    setDraft(prev => ({ ...prev, [section]: { ...prev[section], ...updates } }))
    setDirtyKeys(prev => new Set([...prev, section]))
  }

  function start() {
    setEditMode(true)
    window.setTimeout(() => document.getElementById('home-editable')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function reset() {
    setDraft(content)
    setDirtyKeys(new Set())
    setResetKey(k => k + 1)
    setEditMode(false)
  }

  async function discard() {
    if (dirty && kit && !(await kit.confirm({ title: 'Discard your text changes?', body: 'Nothing has been saved yet.', confirm: 'Discard', danger: true }))) return
    reset()
  }

  async function save() {
    setSaving(true)
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
      setDirtyKeys(new Set())
      setEditMode(false)
      kit?.toast('Homepage text saved')
      router.refresh()
    } catch (e: any) {
      kit?.toast(`Couldn’t save: ${typeof e === 'string' ? e : 'unknown error'}`, 'error')
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
      {/* The ticker is rendered globally by the root layout (editable there). */}
      {hero}
      {brief}
      <div id="home-editable" className={editMode ? 'akit-editable-zone' : undefined}>
        <Features   content={draft.features}    {...ep('features')} />
        <CTASection content={draft.cta_section} {...ep('cta_section')} />
      </div>

      {kit && (
        <AdminActions>
          {editMode ? (
            <>
              <button type="button" className="akit-btn akit-btn--primary" disabled={!dirty || saving} onClick={() => void save()}>
                {saving ? 'Saving…' : dirty ? 'Save text' : 'No changes yet'}
              </button>
              <button type="button" className="akit-btn" onClick={() => void discard()}>{dirty ? 'Discard' : 'Done'}</button>
              <span className="akit-bar__meta">Click any outlined text at the bottom of the page to change it</span>
            </>
          ) : (
            <button type="button" className="akit-btn akit-btn--primary" onClick={start}>Edit page text</button>
          )}
        </AdminActions>
      )}
    </>
  )
}
