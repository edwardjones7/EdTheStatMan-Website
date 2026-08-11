'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  season: number
  /** Currently viewed week, used for the "Sync this week" button. */
  seasonType?: number
  week?: number
}

export default function NflAdminBar({ season, seasonType, week }: Props) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function runSync(body: Record<string, number>) {
    setSyncing(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/nfl-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      const failNote = data.failed?.length ? ` · ${data.failed.length} failed` : ''
      setMessage(`Synced: ${data.inserted} new, ${data.updated} updated${failNote}`)
      router.refresh()
    } catch (e: any) {
      setMessage(e.message ?? 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      gap: '10px',
      alignItems: 'center',
      flexWrap: 'wrap',
      margin: '16px 0',
      padding: '12px 16px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '10px',
    }}>
      <span style={{
        fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em',
        textTransform: 'uppercase', color: 'var(--text-muted)',
      }}>
        Admin · ESPN Sync
      </span>
      <button
        className="btn btn--outline btn--sm"
        onClick={() => runSync({ season })}
        disabled={syncing}
      >
        {syncing ? 'Syncing…' : `Sync full ${season} season`}
      </button>
      {seasonType !== undefined && week !== undefined && (
        <button
          className="btn btn--outline btn--sm"
          onClick={() => runSync({ season, seasonType, week })}
          disabled={syncing}
        >
          Sync this week
        </button>
      )}
      {message && (
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{message}</span>
      )}
    </div>
  )
}
