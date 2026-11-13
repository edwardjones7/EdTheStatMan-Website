// Live status of a pick against the score: "Covering by 3.5", "Needs 2",
// "On pace for 47". Pure, so the browser runs it on every poll.
//
// PROVISIONAL. A final here is what the scoreboard implies, not a grade. Ed's
// grade in the admin is the record; the UI must say "unofficial" until
// todays_bets.result is set.

import type { LiveGame, PickTrack } from './types'

export interface LiveStatus {
  tone: 'up' | 'down' | 'flat' | 'none'
  text: string
  /** Set once the game is final: what the score implies. */
  final: 'win' | 'loss' | 'push' | null
}

const PERIODS: Record<string, { n: number; secs: number }> = {
  nfl: { n: 4, secs: 900 },
  cfb: { n: 4, secs: 900 },
  nba: { n: 4, secs: 720 },
  cbb: { n: 2, secs: 1200 },
}

/** Share of regulation played, 0..1. Overtime counts as 1. */
export function elapsedFraction(g: Pick<LiveGame, 'sport' | 'state' | 'period' | 'clockSeconds'>): number {
  if (g.state === 'post') return 1
  if (g.state !== 'in') return 0
  const p = PERIODS[g.sport] ?? PERIODS.nfl
  if (g.period > p.n) return 1
  const left = g.clockSeconds ?? p.secs
  const played = (Math.max(1, g.period) - 1) * p.secs + (p.secs - Math.min(p.secs, left))
  return Math.min(1, Math.max(0, played / (p.n * p.secs)))
}

export function fmt(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

const NONE: LiveStatus = { tone: 'none', text: '', final: null }

export function pickStatus(track: PickTrack, g: LiveGame): LiveStatus {
  if (g.state === 'pre' || g.home.score == null || g.away.score == null) return NONE
  const done = g.state === 'post'
  const home = g.home.score
  const away = g.away.score

  if ((track.market === 'spread' || track.market === 'moneyline') && track.side) {
    const mine = track.side === 'home' ? home : away
    const theirs = track.side === 'home' ? away : home
    const margin = mine - theirs + (track.market === 'spread' ? track.line ?? 0 : 0)
    if (done) {
      const final = margin > 0 ? 'win' : margin < 0 ? 'loss' : 'push'
      return { tone: final === 'win' ? 'up' : final === 'loss' ? 'down' : 'flat', text: final === 'push' ? 'Push' : final === 'win' ? 'Cashed' : 'Missed', final }
    }
    if (track.market === 'moneyline') {
      const lead = mine - theirs
      return lead === 0 ? { tone: 'flat', text: 'Tied', final: null }
        : { tone: lead > 0 ? 'up' : 'down', text: lead > 0 ? `Up ${fmt(lead)}` : `Down ${fmt(-lead)}`, final: null }
    }
    return margin === 0 ? { tone: 'flat', text: 'On the number', final: null }
      : { tone: margin > 0 ? 'up' : 'down', text: margin > 0 ? `Covering by ${fmt(margin)}` : `Needs ${fmt(-margin)}`, final: null }
  }

  if (track.market === 'total' && track.ou && track.line != null) {
    const sum = home + away
    const diff = sum - track.line
    if (done) {
      const final = diff === 0 ? 'push' : (diff > 0) === (track.ou === 'over') ? 'win' : 'loss'
      return { tone: final === 'win' ? 'up' : final === 'loss' ? 'down' : 'flat', text: `${final === 'push' ? 'Push' : final === 'win' ? 'Cashed' : 'Missed'}, ${sum} total`, final }
    }
    const frac = elapsedFraction(g)
    const pace = frac > 0.08 ? ` · pace ${fmt(sum / frac)}` : ''
    if (track.ou === 'over') {
      return diff > 0 ? { tone: 'up', text: `Over by ${fmt(diff)}`, final: null }
        : { tone: frac > 0.08 && sum / frac > track.line ? 'up' : 'down', text: `Needs ${Math.floor(track.line) + 1 - sum} more${pace}`, final: null }
    }
    return diff >= 0 ? { tone: 'down', text: `Over the number by ${fmt(diff)}`, final: null }
      : { tone: frac > 0.08 && sum / frac > track.line ? 'down' : 'up', text: `${fmt(-diff)} to spare${pace}`, final: null }
  }

  return NONE
}
