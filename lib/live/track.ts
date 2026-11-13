// Turn a visible pick into something the live board can grade against a score.
//
// Server only, and only ever given picks the visitor is entitled to see: the
// side and number of a locked pick must never reach the browser. Anything that
// cannot be graded from a full-game score (props, halves, quarters, team
// totals) becomes market 'other' and shows the score without a status.

import { teamScore } from '../picks/game-match'
import type { PickTrack } from './types'

export interface TrackGame {
  id: string
  sport: string
  home_team: string
  home_abbrev: string
  away_team: string
  away_abbrev: string
}

export interface TrackPick {
  id: string
  gameId: string | null
  bet: string
  line: string | null
}

const PARTIAL = /\b(1h|2h|1q|2q|3q|4q|1st|2nd|3rd|4th|first|second|half|quarter|team total|tt|alt)\b/i
const PROP = /\b(pass|passing|rush|rushing|rec|receiving|receptions|yds|yards|td|tds|touchdowns?|pts|points|reb|rebounds|ast|assists|threes|3pt|3pm|pra|sog|hits|strikeouts|sacks|ints?|completions|attempts|longest|anytime)\b/i

/** Lowest believable full-game total, per sport. Below it, "over 2.5" is a prop. */
const MIN_TOTAL: Record<string, number> = { nfl: 20, cfb: 20, nba: 150, cbb: 90 }

function number(s: string | null | undefined): number | null {
  if (!s) return null
  if (/^\s*(pk|pick|pick'?em|even)\s*$/i.test(s)) return 0
  const m = s.match(/[+-]?\d+(?:\.\d+)?/)
  return m ? Number(m[0]) : null
}

function sideOf(text: string, g: TrackGame): 'home' | 'away' | null {
  const h = teamScore(text, g.home_team, g.home_abbrev)
  const a = teamScore(text, g.away_team, g.away_abbrev)
  if (h === a) return null
  return h > a ? 'home' : 'away'
}

export function trackPick(p: TrackPick, g: TrackGame): PickTrack {
  const base: PickTrack = { pickId: p.id, gameId: g.id, market: 'other', side: null, ou: null, line: null }
  const bet = p.bet.trim()
  if (!bet || PARTIAL.test(bet) || PROP.test(bet)) return base

  const ouWord = bet.match(/\b(over|under)\b/i)?.[1] ?? bet.match(/(?:^|\s)([ou])\s?\d/i)?.[1]
  if (ouWord) {
    const ou = ouWord.toLowerCase().startsWith('o') ? 'over' : 'under'
    const line = number(p.line) ?? number(bet.slice(bet.search(/\b(over|under)\b|(?:^|\s)[ou]\s?\d/i)))
    if (line == null || line < (MIN_TOTAL[g.sport] ?? 20)) return base
    return { ...base, market: 'total', ou, line: Math.abs(line) }
  }

  const side = sideOf(bet, g)
  if (!side) return base

  if (/\b(ml|moneyline|money line)\b/i.test(bet)) return { ...base, market: 'moneyline', side }

  // Odds in brackets and digit names ("49ers", "76ers") are not the number.
  const line = number(p.line) ?? number(bet.replace(/\([^)]*\)/g, '').replace(/\b\d+ers\b/gi, ''))
  if (line == null || Math.abs(line) > 60) return base
  return { ...base, market: 'spread', side, line }
}
