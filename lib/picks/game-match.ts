/**
 * Which Desk game is a pick on?
 *
 * Picks are typed free-hand ("Bears +7", "Duke PK", "Knicks/Heat Under 212.5"),
 * so there is no id to join on. This matches on what IS reliable:
 *
 *   1. sport   the pick's sport (NFL / CFB / NBA / CBB) is the Desk league
 *   2. date    the pick's date is the game's Eastern calendar day. The day
 *              after is tried too, for a pick dated the night before a game
 *   3. team    a team named in the bet or opponent text: full name, nickname
 *              ("Bears"), school ("Duke"), or abbreviation as a whole word
 *
 * A pick matches only when exactly ONE game is the best fit. Two games with
 * equally good fits (two "Michigan" games on a Saturday, a prop naming only a
 * player) leave it unmatched rather than guessed. A wrong bet on a game page
 * is worse than a missing one, and the admin editor can always set it by hand.
 *
 * game_id arrives with pricing_01_trial_and_pick_games.sql; hasPickGameColumn()
 * probes for it so saves keep working before the migration.
 */

import { easternDate, addDays } from '@/lib/desk'

export interface MatchableGame {
  id: string
  sport: string
  kickoff: string | null
  home_team: string
  home_abbrev: string
  away_team: string
  away_abbrev: string
}

export interface MatchablePick {
  sport: string | null
  date: string | null
  bet: string | null
  opponent?: string | null
}

/** Pick sport label -> Desk league key. Only the Desk's four leagues have games. */
const PICK_SPORT_TO_DESK: Record<string, string> = {
  NFL: 'nfl',
  CFB: 'cfb',
  NCAAF: 'cfb',
  NBA: 'nba',
  CBB: 'cbb',
  NCAAB: 'cbb',
  NCAAM: 'cbb',
}

export function deskSportOfPick(sport: string | null | undefined): string | null {
  return PICK_SPORT_TO_DESK[String(sport ?? '').trim().toUpperCase()] ?? null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/**
 * todays_bets.date is TEXT. Newer rows are ISO (2026-11-02); older ones were
 * typed by hand ("Nov 2", "11/2", "11/2/26"). A date without a year takes the
 * Eastern year now, or last year if that would put it more than two months
 * ahead (a January pick read in late December stays where it is).
 */
export function isoPickDate(raw: string | null | undefined, now: Date = new Date()): string | null {
  const v = String(raw ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  let m: number | null = null, d: number | null = null, y: number | null = null
  let x = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(v)
  if (x) { m = +x[1]; d = +x[2]; y = x[3] ? +x[3] : null }
  else if ((x = /^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i.exec(v))) {
    const i = MONTHS.indexOf(x[1].toLowerCase())
    if (i >= 0) { m = i + 1; d = +x[2]; y = x[3] ? +x[3] : null }
  }
  if (!m || !d || m > 12 || d > 31) return null
  if (y !== null && y < 100) y += 2000
  const pad = (n: number) => String(n).padStart(2, '0')
  if (y === null) {
    const thisYear = +easternDate(now).slice(0, 4)
    const guess = `${thisYear}-${pad(m)}-${pad(d)}`
    y = Date.parse(guess) - now.getTime() > 62 * 864e5 ? thisYear - 1 : thisYear
  }
  return `${y}-${pad(m)}-${pad(d)}`
}

function norm(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9&]+/g, ' ').trim()} `
}

/**
 * How strongly `text` names this team. 0 = not at all. Longer names score
 * higher so "Michigan State" beats "Michigan" for a Spartans bet.
 */
export function teamScore(text: string, full: string, abbrev: string): number {
  const t = norm(text)
  const f = norm(full).trim()
  if (!f) return 0
  if (t.includes(` ${f} `)) return 100 + f.length
  const words = f.split(' ')
  let best = 0
  // Nickname: the last word, or the last two ("Trail Blazers", "Red Sox").
  for (const n of [words.slice(-2).join(' '), words[words.length - 1]]) {
    if (words.length > 1 && n.length >= 3 && t.includes(` ${n} `)) best = Math.max(best, 50 + n.length)
  }
  // Location / school: the full name minus its last word, then shorter
  // prefixes ("Duke" from "Duke Blue Devils"). A shorter prefix scores lower
  // than a whole location, so "Michigan -10" picks the Wolverines (location
  // "Michigan", whole) over the Spartans (location "Michigan State", partial).
  for (let k = words.length - 1; k >= 1; k--) {
    const loc = words.slice(0, k).join(' ')
    if (loc.length >= 4 && t.includes(` ${loc} `)) {
      best = Math.max(best, (k === words.length - 1 ? 40 : 25) + loc.length)
      break
    }
  }
  const ab = abbrev.trim().toLowerCase()
  if (ab.length >= 2 && t.includes(` ${ab} `)) best = Math.max(best, 20)
  return best
}

/** The single best game for this pick, or null if there is none or a tie. */
export function matchGame(pick: MatchablePick, games: MatchableGame[]): string | null {
  const sport = deskSportOfPick(pick.sport)
  const date = isoPickDate(pick.date)
  if (!sport || !date) return null
  const text = [pick.bet, pick.opponent].filter(Boolean).join(' ')
  if (!text.trim()) return null

  for (const day of [date, addDays(date, 1)]) {
    const scored = games
      .filter(g => g.sport === sport && g.kickoff && easternDate(g.kickoff) === day)
      .map(g => ({
        id: g.id,
        score: Math.max(teamScore(text, g.home_team, g.home_abbrev), teamScore(text, g.away_team, g.away_abbrev)),
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
    if (scored.length === 0) continue
    if (scored.length > 1 && scored[0].score === scored[1].score) return null
    return scored[0].id
  }
  return null
}

let gameColumn = false

/** Has pricing_01_trial_and_pick_games.sql added todays_bets.game_id? */
export async function hasPickGameColumn(admin: any): Promise<boolean> {
  if (gameColumn) return true
  const { error } = await admin.from('todays_bets').select('game_id').limit(1)
  gameColumn = !error
  return gameColumn
}

/** Candidate games for a pick: its league, its day and the day after. */
export async function candidateGames(admin: any, pick: MatchablePick): Promise<MatchableGame[]> {
  const sport = deskSportOfPick(pick.sport)
  const date = isoPickDate(pick.date)
  if (!sport || !date) return []
  // Padded past both Eastern UTC offsets; matchGame() trims to the exact day.
  const { data } = await admin
    .from('nfl_games')
    .select('id, sport, kickoff, home_team, home_abbrev, away_team, away_abbrev')
    .eq('sport', sport)
    .gte('kickoff', `${date}T03:00:00Z`)
    .lt('kickoff', `${addDays(date, 2)}T06:00:00Z`)
    .order('kickoff', { ascending: true })
  return (data ?? []) as MatchableGame[]
}

/**
 * The game_id column value for a pick being saved, as a patch.
 *
 *   body.game_id === 'auto'      match it now (the editor's default)
 *   body.game_id is a uuid       the admin chose a game: use it
 *   body.game_id === null        the admin said "no game": store null
 *   body.game_id absent          `absent`: 'auto' for a new pick, 'keep' for
 *                                an edit from a client that does not know
 *                                the field, so it never clobbers a choice
 *
 * Returns {} when the column does not exist yet, so the save is unchanged.
 */
export async function gameIdPatch(
  admin: any,
  body: any,
  pick: MatchablePick,
  absent: 'auto' | 'keep' = 'auto',
): Promise<{ game_id?: string | null }> {
  if (!(await hasPickGameColumn(admin))) return {}
  const v = body?.game_id
  if (typeof v === 'string' && v && v !== 'auto') return { game_id: v }
  if (v === null || v === '') return { game_id: null }
  if (v === undefined && absent === 'keep') return {}
  try {
    return { game_id: matchGame(pick, await candidateGames(admin, pick)) }
  } catch (e: any) {
    console.error(`[game-match] could not match pick: ${e?.message ?? e}`)
    return {}
  }
}
