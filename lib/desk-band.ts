// The band above the Research Desk board: the scores strip's server seed and
// the week's line movers. Pure shaping over the games the page already read,
// so neither costs a query.

import type { PublicNflGame } from './nfl'
import { spreadLabel, gamePath } from './nfl'
import type { StripSeed } from '@/components/live/LiveStrip'

const minus = (s: string) => s.replace(/-/g, '−')

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

export interface DeskMover {
  key: string
  href: string
  matchup: string
  detail: string
  value: string
  tone: 'up' | 'down' | 'move'
  size: number
}

/**
 * The biggest line moves on the games still to be played this week, one entry
 * per game (its bigger move), largest first. The spread swing is measured
 * home-relative, so a favourite flipping sides still counts its full distance.
 */
export function deskMovers(sport: string, games: PublicNflGame[], limit = 5): DeskMover[] {
  const best = new Map<string, DeskMover>()
  for (const g of games) {
    if (g.status === 'post') continue
    const href = gamePath(sport, g.slug)
    const matchup = `${g.away_abbrev} @ ${g.home_abbrev}`
    const found: DeskMover[] = []

    if (g.spread_open != null && g.spread_current != null && g.spread_open !== g.spread_current) {
      const swing = Math.abs(Number((g.spread_current - g.spread_open).toFixed(1)))
      const now = spreadLabel(g.spread_current, g.home_abbrev, g.away_abbrev)
      const then = spreadLabel(g.spread_open, g.home_abbrev, g.away_abbrev)
      if (swing > 0 && now && then) {
        found.push({
          key: `${g.id}-s`, href, matchup,
          detail: minus(`Spread ${now}, opened ${then}`),
          value: `${fmt(swing)} pts`, tone: 'move', size: swing,
        })
      }
    }
    if (g.total_open != null && g.total_current != null && g.total_open !== g.total_current) {
      const delta = Number((g.total_current - g.total_open).toFixed(1))
      if (delta !== 0) {
        found.push({
          key: `${g.id}-t`, href, matchup,
          detail: `Total ${fmt(g.total_current)}, opened ${fmt(g.total_open)}`,
          value: minus(delta > 0 ? `+${fmt(delta)}` : fmt(delta)),
          tone: delta > 0 ? 'up' : 'down', size: Math.abs(delta),
        })
      }
    }
    const top = found.sort((a, b) => b.size - a.size)[0]
    if (top) best.set(g.id, top)
  }
  return [...best.values()].sort((a, b) => b.size - a.size).slice(0, limit)
}

/** "Sun 1:00 PM" in New York time, or the score line once it has started. */
function shortWhen(g: PublicNflGame): string {
  if (g.status === 'post') return 'Final'
  if (g.status === 'in') return 'Live'
  if (!g.kickoff) return 'TBD'
  if (g.kickoff_tbd) {
    return new Date(g.kickoff).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' }) + ' TBD'
  }
  return new Date(g.kickoff).toLocaleString('en-US', {
    weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
  })
}

/**
 * What the scores strip shows before its first poll lands: the board's games,
 * live first, then upcoming in kickoff order, then finals. Capped, because a
 * college basketball night can be hundreds of games.
 */
export function deskStripSeed(sport: string, games: PublicNflGame[], max = 30): StripSeed[] {
  const rank = (g: PublicNflGame) => (g.status === 'in' ? 0 : g.status === 'post' ? 2 : 1)
  const ms = (g: PublicNflGame) => (g.kickoff ? new Date(g.kickoff).getTime() : Number.MAX_SAFE_INTEGER)
  return [...games]
    .sort((a, b) => rank(a) - rank(b) || ms(a) - ms(b))
    .slice(0, max)
    .map(g => ({
      id: g.id,
      href: gamePath(sport, g.slug),
      short: shortWhen(g),
      broadcast: g.broadcast ?? null,
      awayAbbrev: g.away_abbrev,
      homeAbbrev: g.home_abbrev,
      awayRecord: g.status !== 'pre' && g.away_score != null ? String(g.away_score) : g.away_record ?? null,
      homeRecord: g.status !== 'pre' && g.home_score != null ? String(g.home_score) : g.home_record ?? null,
      spread: (() => { const s = spreadLabel(g.spread_current, g.home_abbrev, g.away_abbrev); return s ? minus(s) : null })(),
      total: g.total_current != null ? fmt(g.total_current) : null,
    }))
}

/** The next games still to play on the board, kickoff order, for the rail fallback. */
export function deskUpNext(sport: string, games: PublicNflGame[], limit = 5) {
  return games
    .filter(g => g.status === 'pre')
    .sort((a, b) => (a.kickoff ? new Date(a.kickoff).getTime() : Infinity) - (b.kickoff ? new Date(b.kickoff).getTime() : Infinity))
    .slice(0, limit)
    .map(g => ({
      key: g.id,
      href: gamePath(sport, g.slug),
      matchup: `${g.away_abbrev} @ ${g.home_abbrev}`,
      when: shortWhen(g),
      line: (() => { const s = spreadLabel(g.spread_current, g.home_abbrev, g.away_abbrev); return s ? minus(s) : null })(),
    }))
}
