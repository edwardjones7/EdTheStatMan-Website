// Game previews, written from facts the Desk holds or computes: the market and
// how it has moved, each team's last result and season against the spread,
// over/under runs, the injury report, the kickoff forecast, and how much
// research is attached.
//
// Fill-in templates, not a model: nothing here can invent a fact, every
// sentence is ours, and it costs nothing to run. Original content on our own
// domain is the point; nothing is taken from anyone's article.

import type { NflGame } from './nfl'
import { spreadLabel } from './nfl'
import { teamAtsResult, teamSuResult, teamLine, ouResult } from './ats'
import { teamShortName } from './desk-teams'
import type { Injury } from './feeds/injuries'
import { isKeyPosition } from './feeds/injuries'

export interface PreviewInput {
  game: NflGame
  homeSeason: NflGame[]
  awaySeason: NflGame[]
  homeInjuries: Injury[]
  awayInjuries: Injury[]
  weather: { tempF: number | null; windMph: number | null; sky: string | null; precipPct: number | null } | null
  linkedCount: number
  betsCount: number
}

const n = (x: number) => {
  const r = Math.round(x * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}
const minus = (s: string) => s.replace(/-/g, '−')

/** "Packers" for the pros, "Alabama" for college. */
function name(sport: string, abbrev: string, full: string): string {
  if (sport === 'cfb' || sport === 'cbb') return teamShortName(sport, abbrev, full)
  const parts = full.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : full
}

function before(rows: NflGame[], g: NflGame): NflGame[] {
  const t = g.kickoff ? Date.parse(g.kickoff) : Infinity
  return rows.filter(r => r.id !== g.id && r.status === 'post' && r.kickoff && Date.parse(r.kickoff) < t)
}

function atsRecord(rows: NflGame[], abbrev: string, where?: 'home' | 'away') {
  let w = 0, l = 0, p = 0
  for (const r of rows) {
    if (where === 'home' && r.home_abbrev !== abbrev) continue
    if (where === 'away' && r.away_abbrev !== abbrev) continue
    const x = teamAtsResult(r, abbrev)
    if (x === 'W') w++
    else if (x === 'L') l++
    else if (x === 'P') p++
  }
  return { w, l, p, n: w + l + p, text: `${w}-${l}${p ? `-${p}` : ''}` }
}

function ouRecord(rows: NflGame[]) {
  let o = 0, u = 0
  for (const r of rows) {
    const x = ouResult(r)
    if (x === 'over') o++
    else if (x === 'under') u++
  }
  return { o, u }
}

/** "come off a 27-20 win over the Bills, covering as 3-point underdogs" */
function lastGame(sport: string, rows: NflGame[], abbrev: string): string | null {
  const last = rows[rows.length - 1]
  if (!last || last.home_score == null || last.away_score == null) return null
  const home = last.home_abbrev === abbrev
  const mine = home ? last.home_score : last.away_score
  const theirs = home ? last.away_score : last.home_score
  const opp = home ? name(sport, last.away_abbrev, last.away_team) : name(sport, last.home_abbrev, last.home_team)
  const su = teamSuResult(last, abbrev)
  const word = su === 'W' ? 'win over' : su === 'L' ? 'loss to' : 'tie with'
  // Scores read high-low however it went: "a 19-15 loss", never "a 15-19 loss".
  let s = `${Math.max(mine, theirs)}-${Math.min(mine, theirs)} ${word} ${sport === 'nfl' || sport === 'nba' ? 'the ' : ''}${opp}`
  const line = teamLine(last, abbrev)
  const ats = teamAtsResult(last, abbrev)
  if (line != null && ats) {
    const role = line < 0 ? `${n(-line)}-point favorites` : line > 0 ? `${n(line)}-point underdogs` : 'a pick’em'
    s += ats === 'W' ? `, covering as ${role}` : ats === 'L' ? `, failing to cover as ${role}` : `, a push as ${role}`
  }
  return s
}

function injuryLine(team: string, list: Injury[], plural: boolean): string | null {
  const key = list.filter(i => (i.status === 'Out' || i.status === 'Doubtful') && isKeyPosition(i.pos)).slice(0, 3)
  if (key.length === 0) return null
  const parts = key.map(i => `${i.pos} ${i.name}${i.detail ? ` (${i.detail.toLowerCase()})` : ''} ${i.status === 'Out' ? 'out' : 'doubtful'}`.replace(/\((coach's decision|personal|rest)\) (out|doubtful)/i, '$2 ($1)'))
  const last = parts.pop()!
  return `${team} ${plural ? 'list' : 'lists'} ${parts.length ? `${parts.join(', ')} and ${last}` : last}.`
}

/** Paragraphs for a game that has not started. Empty for anything else. */
export function buildPreview(p: PreviewInput): string[] {
  const g = p.game
  if (g.status !== 'pre') return []
  const sport = g.sport ?? 'nfl'
  const home = name(sport, g.home_abbrev, g.home_team)
  const away = name(sport, g.away_abbrev, g.away_team)
  // Pro nicknames are plural with "the" ("the Vikings are"); college schools
  // are singular without it ("Alabama is").
  const pro = sport === 'nfl' || sport === 'nba'
  const the = (t: string) => (pro ? `the ${t}` : t)
  const The = (t: string) => (pro ? `The ${t}` : t)
  const are = pro ? 'are' : 'is'
  const homeRows = before(p.homeSeason, g)
  const awayRows = before(p.awaySeason, g)
  const out: string[] = []

  // 1. Form.
  const form: string[] = []
  const al = lastGame(sport, awayRows, g.away_abbrev)
  const hl = lastGame(sport, homeRows, g.home_abbrev)
  if (al) form.push(`${The(away)} ${pro ? 'come' : 'comes'} off a ${al}.`)
  if (hl) form.push(`${The(home)} ${al ? `${are} coming off` : pro ? 'come off' : 'comes off'} a ${hl}.`)
  const aAts = atsRecord(awayRows, g.away_abbrev)
  const hAts = atsRecord(homeRows, g.home_abbrev)
  if (aAts.n >= 3 && hAts.n >= 3) {
    form.push(`Against the spread this season, ${the(away)} ${are} ${aAts.text} and ${the(home)} ${are} ${hAts.text}.`)
    const road = atsRecord(awayRows, g.away_abbrev, 'away')
    const atHome = atsRecord(homeRows, g.home_abbrev, 'home')
    if (road.n >= 3 && atHome.n >= 3) {
      form.push(`On the road ${the(away)} ${are} ${road.text} ATS; at home ${the(home)} ${are} ${atHome.text}.`)
    }
  }
  if (form.length) out.push(form.join(' '))

  // 2. The market.
  const market: string[] = []
  const so = g.spread_open, sc = g.spread_current
  if (sc != null) {
    const now = spreadLabel(sc, g.home_abbrev, g.away_abbrev)
    if (so != null && so !== sc) {
      const was = spreadLabel(so, g.home_abbrev, g.away_abbrev)
      const toward = sc > so ? away : home
      market.push(`The spread opened ${minus(was ?? '')} and sits at ${minus(now ?? '')}, a ${n(Math.abs(sc - so))}-point move toward ${the(toward)}.`)
    } else if (now) {
      market.push(`The spread is ${minus(now)}${so != null ? ', unchanged since it opened' : ''}.`)
    }
  }
  const to = g.total_open, tc = g.total_current
  if (tc != null) {
    market.push(to != null && to !== tc
      ? `The total has ${tc > to ? 'climbed' : 'dropped'} from ${n(to)} to ${n(tc)}.`
      : `The total is ${n(tc)}.`)
  }
  const aOu = ouRecord(awayRows), hOu = ouRecord(homeRows)
  const lean = (r: { o: number; u: number }, t: string) => {
    const k = r.o + r.u
    if (k < 4) return null
    if (r.o / k >= 0.7) return `Overs are ${r.o}-${r.u} in ${t} games`
    if (r.u / k >= 0.7) return `unders are ${r.u}-${r.o} in ${t} games`
    return null
  }
  const leans = [lean(aOu, away), lean(hOu, home)].filter(Boolean) as string[]
  if (leans.length) market.push(`${leans.join('; ').replace(/^u/, 'U')}.`)
  if (market.length) out.push(market.join(' '))

  // 3. Injuries and conditions.
  const cond: string[] = []
  const ai = injuryLine(The(away), p.awayInjuries, pro)
  const hi = injuryLine(The(home), p.homeInjuries, pro)
  if (ai) cond.push(ai)
  if (hi) cond.push(hi)
  if (!ai && !hi && (sport === 'nfl' || sport === 'nba') && (p.awayInjuries.length || p.homeInjuries.length)) {
    cond.push('Neither side lists a key-position player as out or doubtful.')
  }
  if (g.venue_indoor) {
    if (sport === 'nfl' || sport === 'cfb') cond.push('It is played indoors, so weather is not a factor.')
  } else if (p.weather) {
    const w = p.weather
    const bits = [
      w.tempF != null ? `${w.tempF}°F` : null,
      w.windMph != null ? `wind around ${w.windMph} mph` : null,
      w.sky ? w.sky.toLowerCase() : null,
    ].filter(Boolean)
    if (bits.length) cond.push(`The kickoff forecast calls for ${bits.join(', ')}${w.precipPct != null && w.precipPct >= 30 ? `, with a ${w.precipPct}% chance of precipitation` : ''}.`)
  }
  if (cond.length) out.push(cond.join(' '))

  // 4. What is on the page.
  const desk: string[] = []
  if (p.linkedCount > 0) desk.push(`${p.linkedCount} Vault ${p.linkedCount === 1 ? 'system or trend fits' : 'systems and trends fit'} this matchup; they are listed below.`)
  if (p.betsCount > 0) desk.push(`Ed has ${p.betsCount === 1 ? 'a play' : `${p.betsCount} plays`} on this game.`)
  if (desk.length) out.push(desk.join(' '))

  return out
}
