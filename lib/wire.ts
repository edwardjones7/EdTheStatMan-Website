// The Wire: short briefs written by us from facts, each pointing at the Desk
// game it is about. Injury designations for key positions and line moves on
// upcoming games. Every word is a template filled with data (status, body
// part, position, the numbers), so nothing is copied from anyone's reporting,
// and every brief keeps the reader on our site.

import { LIVE_SPORTS, LIVE_SPORT_LABEL, type LiveSport } from './live/types'
import { loadInjuries, isKeyPosition, type Injury } from './feeds/injuries'
import { loadUpcoming, type UpcomingGame } from './feeds/upcoming'
import { spreadLabel } from './nfl'
import { teamShortName } from './desk-teams'

export interface WireItem {
  id: string
  kind: 'injury' | 'line'
  sport: LiveSport
  sportLabel: string
  headline: string
  body: string
  href: string
  /** For sorting and "2h ago": the injury update time, else kickoff. */
  at: string | null
  /** Bigger is more newsworthy; used to pick the front-page few. */
  weight: number
}

const n = (x: number) => {
  const r = Math.round(x * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
const minus = (s: string | null) => (s ?? '').replace(/-/g, '−')

function team(sport: string, abbrev: string, full: string): string {
  if (sport === 'cfb' || sport === 'cbb') return teamShortName(sport, abbrev, full)
  const parts = full.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : full
}

function day(iso: string | null): string {
  if (!iso) return 'this week'
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' })
}

function marketLine(g: UpcomingGame): string {
  const now = spreadLabel(g.spread_current, g.home_abbrev, g.away_abbrev)
  const was = spreadLabel(g.spread_open, g.home_abbrev, g.away_abbrev)
  const parts: string[] = []
  if (now) parts.push(was && g.spread_open !== g.spread_current ? `The spread is ${minus(now)} (opened ${minus(was)})` : `The spread is ${minus(now)}`)
  if (g.total_current != null) parts.push(g.total_open != null && g.total_open !== g.total_current ? `the total ${n(g.total_current)} (opened ${n(g.total_open)})` : `the total ${n(g.total_current)}`)
  return parts.length ? `${parts.join(' and ')}.` : ''
}

const POS_WEIGHT: Record<string, number> = { QB: 10, PG: 6, RB: 4, WR: 4, TE: 3, C: 3, SF: 4, SG: 4, PF: 4, F: 3, G: 3, LT: 3, EDGE: 3, DE: 3, CB: 3 }

function injuryItem(g: UpcomingGame, teamFull: string, i: Injury): WireItem {
  const isHome = teamFull === g.home_team
  const t = team(g.sport, isHome ? g.home_abbrev : g.away_abbrev, teamFull)
  const opp = isHome ? team(g.sport, g.away_abbrev, g.away_team) : team(g.sport, g.home_abbrev, g.home_team)
  const status = i.status === 'Out' ? 'out' : 'doubtful'
  const part = i.detail ? ` (${i.detail.toLowerCase()})` : ''
  const headline = i.status === 'Out'
    ? `${t} ${i.pos} ${i.name} out for ${day(g.kickoff)} vs. ${opp}`
    : `${t} ${i.pos} ${i.name} doubtful for ${day(g.kickoff)} vs. ${opp}`
  const body = `${i.name}${part} is listed as ${status} for ${team(g.sport, g.away_abbrev, g.away_team)} at ${team(g.sport, g.home_abbrev, g.home_team)}. ${marketLine(g)} Both teams' full injury reports are on the game page.`
  return {
    id: `inj-${g.id}-${i.name}`,
    kind: 'injury',
    sport: g.sport,
    sportLabel: LIVE_SPORT_LABEL[g.sport],
    headline,
    body: body.replace(/\s+/g, ' ').trim(),
    href: g.href,
    at: i.date ?? g.kickoff,
    weight: (POS_WEIGHT[i.pos ?? ''] ?? 1) * (i.status === 'Out' ? 1 : 0.8),
  }
}

function lineItem(g: UpcomingGame): WireItem | null {
  const items: string[] = []
  let weight = 0
  let headline = ''
  const away = team(g.sport, g.away_abbrev, g.away_team)
  const home = team(g.sport, g.home_abbrev, g.home_team)
  // College basketball moves a lot on thin markets; only real moves make the wire.
  const big = g.sport === 'cbb' ? 4 : g.sport === 'nba' ? 3 : 2
  if (g.spread_open != null && g.spread_current != null && Math.abs(g.spread_current - g.spread_open) >= big) {
    const d = Math.abs(g.spread_current - g.spread_open)
    const toward = g.spread_current > g.spread_open ? away : home
    const the = g.sport === 'nfl' || g.sport === 'nba' ? 'the ' : ''
    headline = `${away} at ${home}: spread moves ${n(d)} points toward ${the}${toward}`
    items.push(`The spread opened ${minus(spreadLabel(g.spread_open, g.home_abbrev, g.away_abbrev))} and is now ${minus(spreadLabel(g.spread_current, g.home_abbrev, g.away_abbrev))}.`)
    weight += d
  }
  const tbig = g.sport === 'cbb' ? 6 : g.sport === 'nba' ? 5 : 3
  if (g.total_open != null && g.total_current != null && Math.abs(g.total_current - g.total_open) >= tbig) {
    const d = g.total_current - g.total_open
    if (!headline) headline = `${away} at ${home}: total ${d > 0 ? 'climbs' : 'drops'} ${n(Math.abs(d))} to ${n(g.total_current)}`
    items.push(`The total opened ${n(g.total_open)} and sits at ${n(g.total_current)}.`)
    weight += Math.abs(d) * 0.6
  }
  if (!headline) return null
  return {
    id: `line-${g.id}`,
    kind: 'line',
    sport: g.sport,
    sportLabel: LIVE_SPORT_LABEL[g.sport],
    headline,
    body: `${items.join(' ')} ${g.sport === 'nba' || g.sport === 'cbb' ? 'Tip-off' : 'Kickoff'} is ${day(g.kickoff)}. The game page has the full market, the injury reports and the Vault rows that fit.`,
    href: g.href,
    // No timestamp for when a line moved, so none is shown.
    at: null,
    weight,
  }
}

export async function loadWire(days = 4): Promise<WireItem[]> {
  const sports = [...LIVE_SPORTS] as LiveSport[]
  const [games, nfl, nba, cfb] = await Promise.all([
    loadUpcoming(sports, days),
    loadInjuries('nfl'),
    loadInjuries('nba'),
    loadInjuries('cfb'),
  ])
  const reports: Partial<Record<LiveSport, Record<string, Injury[]>>> = { nfl, nba, cfb }
  const injuries: WireItem[] = []
  const lines: WireItem[] = []
  // A player is written up once, for his next game; games come kickoff-first.
  const seen = new Set<string>()
  for (const g of games) {
    if (g.status !== 'pre') continue
    const rep = reports[g.sport]
    if (rep) {
      for (const t of [g.away_team, g.home_team]) {
        for (const i of rep[t] ?? []) {
          if (!((i.status === 'Out' || i.status === 'Doubtful') && isKeyPosition(i.pos))) continue
          const key = `${g.sport}|${t}|${i.name}`
          if (seen.has(key)) continue
          seen.add(key)
          injuries.push(injuryItem(g, t, i))
        }
      }
    }
    const line = lineItem(g)
    if (line) lines.push(line)
  }
  // Injuries newest first; line moves biggest first, at most 12 per league so
  // a busy college basketball week cannot bury everything else.
  injuries.sort((a, b) => String(b.at ?? '').localeCompare(String(a.at ?? '')))
  const perSport = new Map<string, number>()
  const keptLines = lines
    .sort((a, b) => b.weight - a.weight)
    .filter(l => { const c = perSport.get(l.sport) ?? 0; perSport.set(l.sport, c + 1); return c < 12 })
  // Interleave so neither kind runs for a whole screen.
  const out: WireItem[] = []
  for (let i = 0; i < Math.max(injuries.length, keptLines.length); i++) {
    if (injuries[i]) out.push(injuries[i])
    if (keptLines[i]) out.push(keptLines[i])
  }
  return out
}
