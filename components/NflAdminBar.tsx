'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AdminActions, useAdminKit } from './admin-kit/AdminKit'

interface Props {
  /** Which league to sync. The route sweeps that league's own season shape. */
  sport: string
  season: number
  /** How the season reads: "2026-27" for basketball, where `season` is 2027. */
  seasonLabel?: string
  /** Currently viewed week, used for the "Sync this week" button. */
  seasonType?: number
  week?: number
}

/**
 * The Desk's ESPN sync, in the admin bar. "Sync this week" is the everyday
 * button; the two season-wide syncs are heavier and ask first. Results arrive
 * as a toast instead of a line of text in the page.
 */
export default function NflAdminBar({ sport, season, seasonLabel = String(season), seasonType, week }: Props) {
  const router = useRouter()
  const kit = useAdminKit()
  const [syncing, setSyncing] = useState(false)
  if (!kit) return null

  async function runSync(body: Record<string, number | boolean | string>, what: string) {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/nfl-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, ...body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Sync failed')
      const failNote = data.failed?.length ? `, ${data.failed.length} failed` : ''
      const stagedNote = data.published === false ? ', staged (hidden from visitors)' : ''
      const oddsNote = data.odds && data.odds !== 'on' ? `, odds ${data.odds}` : ''
      kit!.toast(`${what}: ${data.inserted} new, ${data.updated} updated${stagedNote}${oddsNote}${failNote}`, data.failed?.length ? 'info' : 'ok')
      router.refresh()
    } catch (e: any) {
      kit!.toast(`${what} failed: ${e.message ?? 'unknown error'}`, 'error')
    } finally {
      setSyncing(false)
    }
  }

  async function season_(staged: boolean) {
    const ok = await kit!.confirm({
      title: staged ? `Stage the ${seasonLabel} ${sport.toUpperCase()} season?` : `Sync the whole ${seasonLabel} ${sport.toUpperCase()} season?`,
      body: staged
        ? 'Pulls every game from ESPN as hidden rows: you see them, visitors do not until they are published.'
        : 'Pulls every game and line from ESPN and publishes new games straight away. It takes a while; this week only is usually enough.',
      confirm: staged ? 'Stage season' : 'Sync season',
    })
    if (ok) await runSync(staged ? { season, publish: false } : { season }, staged ? 'Season staged' : 'Season sync')
  }

  return (
    <AdminActions>
      {seasonType !== undefined && week !== undefined && (
        <button type="button" className="akit-btn akit-btn--primary" disabled={syncing}
          onClick={() => runSync({ season, seasonType, week }, 'This week synced')}>
          {syncing ? 'Syncing…' : 'Sync this week'}
        </button>
      )}
      <button type="button" className="akit-btn" disabled={syncing} onClick={() => void season_(false)}>Sync season…</button>
      <button type="button" className="akit-btn" disabled={syncing} onClick={() => void season_(true)}>Stage season…</button>
    </AdminActions>
  )
}
