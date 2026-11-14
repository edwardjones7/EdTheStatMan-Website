'use client'

import { useState } from 'react'
import type { TodaysBet } from './TodaysBets'
import type { ModelPicksContent } from '@/lib/site-content'
import ModelPicksPage from './ModelPicksPage'
import { IconPencil } from './Icons'

interface Props {
  rows: TodaysBet[]
  userTier: string | null
  headerContent: ModelPicksContent
}

/**
 * The admin's pick editor, under the public Portfolio view. The header text
 * (site_content.model_picks) is no longer editable here: the redesigned public
 * page builds its own header from the card, so edits to it reached nobody.
 */
export default function ModelPicksEditor({ rows, userTier, headerContent }: Props) {
  const [editMode, setEditMode] = useState(false)

  return (
    <>
      <ModelPicksPage
        rows={rows}
        isAdmin={true}
        userTier={userTier}
        isMember={true}
        editMode={editMode}
        headerContent={headerContent}
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
          <button
            onClick={() => setEditMode(false)}
            title="Exit edit mode"
            style={{
              ...fab,
              background: 'rgba(var(--brand-rgb), 0.15)',
              color: 'var(--accent-teal)',
              border: '2px solid rgba(var(--brand-rgb), 0.35)',
            }}
          >
            ✕
          </button>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            title="Edit picks"
            style={{ ...fab, background: 'var(--accent-teal)', color: 'var(--brand-ink)' }}
          >
            <IconPencil size={14} />
          </button>
        )}

        {editMode && (
          <span style={{
            background: 'rgba(var(--brand-rgb), 0.12)',
            border: '1px solid rgba(var(--brand-rgb), 0.25)',
            color: 'var(--accent-teal)',
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
