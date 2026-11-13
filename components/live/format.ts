// Small display helpers for the live widgets. Browser-safe, no imports.

import type { LiveGame } from '@/lib/live/types'

export function minus(s: string): string {
  return s.replace(/-/g, '−')
}

/** Home-relative spread -> "NYG −1.5" / "PK" (same rule as lib/nfl spreadLabel). */
export function spreadText(spread: number | null, g: Pick<LiveGame, 'home' | 'away'>): string | null {
  if (spread == null) return null
  if (spread === 0) return 'PK'
  return minus(spread < 0 ? `${g.home.abbrev} ${spread}` : `${g.away.abbrev} -${spread}`)
}

/** "Thu 8:15 PM", in New York time like the rest of the site. */
export function kickoffText(iso: string | null): string {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })
}

/** The status line for a chip or table cell. */
export function stateText(g: LiveGame): string {
  if (g.state === 'pre') return kickoffText(g.kickoff)
  if (g.state === 'post') return g.detail.replace(/^Final\b/, 'Final') || 'Final'
  return g.detail || 'Live'
}

/** "WSH 14, NYG 10" */
export function scoreText(g: LiveGame): string {
  return `${g.away.abbrev} ${g.away.score ?? 0}, ${g.home.abbrev} ${g.home.score ?? 0}`
}

/** "1h 42m" / "12m" / "48s" */
export function countdown(ms: number): string {
  if (ms <= 0) return 'now'
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}
