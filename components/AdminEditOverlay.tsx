'use client'

import Link from 'next/link'

interface Props {
  section: string
  label: string
}

export default function AdminEditOverlay({ section, label }: Props) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '12px',
        right: '16px',
        zIndex: 50,
        pointerEvents: 'auto',
      }}
    >
      <Link
        href={`/admin?tab=content#${section}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '4px 10px',
          background: 'rgba(52,211,153,0.12)',
          border: '1px solid rgba(52,211,153,0.35)',
          borderRadius: '6px',
          color: 'var(--accent-green)',
          fontSize: '0.72rem',
          fontWeight: 600,
          textDecoration: 'none',
          backdropFilter: 'blur(6px)',
          letterSpacing: '0.02em',
        }}
      >
        ✏ Edit {label}
      </Link>
    </div>
  )
}
