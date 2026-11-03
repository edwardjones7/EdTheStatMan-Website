/**
 * Turn one of Ed's posts into zero or more structured picks.
 *
 * Two parsers, and the queue does not care which one ran:
 *
 *   1. A model behind the Vercel AI Gateway (OpenAI-compatible chat endpoint,
 *      plain fetch, no SDK). It reads prose, emoji, results recaps and odd
 *      phrasings the regexes never will.
 *   2. A deterministic regex parser, used when there is no AI_GATEWAY_API_KEY
 *      or the call fails. Good enough for the common shapes ("Chiefs -3.5 -110",
 *      "Lakers ML +130", "o44.5 Bills/Dolphins", "Mahomes o2.5 pass TD -130").
 *
 * EITHER WAY ED APPROVES. A wrong parse costs a correction in the queue, never a
 * wrong public pick, which is why the fallback can afford to be simple. The
 * one thing both are told never to do is invent a price: an odds figure that
 * was not in the post would put a false number into the units record.
 *
 * The gateway is blocked on billing, not credentials, when it returns 403
 * customer_verification_required (vault Traps). That lands here as a failed
 * call, so the regex parser runs and the draft records why.
 *
 * Self-contained on purpose (no imports), so parse.examples.ts can be run
 * under plain node without the app's path aliases.
 */

export type Market = 'spread' | 'total' | 'moneyline' | 'prop' | 'other'
export const MARKETS: Market[] = ['spread', 'total', 'moneyline', 'prop', 'other']

export interface ParsedPick {
  sport: string | null
  /** Human text, as it will read on the site: "Chiefs -3.5", "Bills/Dolphins Over 44.5". */
  bet: string
  opponent: string | null
  /** The spread or total number ("-3.5", "44.5"), or a prop's line ("2.5"). Not the price. */
  line: string | null
  /** American odds, only when the post states them. */
  odds: number | null
  market: Market
  isProp: boolean
  playerName: string | null
}

export interface ParseResult {
  parser: 'ai' | 'regex'
  model?: string
  /** Why the AI parser did not run or did not answer, when it did not. */
  error?: string
  picks: ParsedPick[]
}

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions'
const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5'

export async function parsePost(text: string): Promise<ParseResult> {
  const key = process.env.AI_GATEWAY_API_KEY
  if (!key) return { parser: 'regex', error: 'AI_GATEWAY_API_KEY not set', picks: parseWithRegex(text) }

  const model = process.env.PICKS_PARSER_MODEL || DEFAULT_MODEL
  try {
    const picks = await parseWithAI(text, key, model)
    return { parser: 'ai', model, picks }
  } catch (e: any) {
    return { parser: 'regex', model, error: String(e?.message ?? e).slice(0, 300), picks: parseWithRegex(text) }
  }
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You extract sports betting picks from a single social media post by a handicapper named Ed.

Return ONLY a JSON object: {"picks": [ ... ]}. Each pick:
{
  "sport": "NFL" | "NBA" | "CFB" | "CBB" | "MLB" | "NHL" | "WNBA" | "CFL" | other short league code | null,
  "bet": human-readable pick as a bettor would write it, e.g. "Chiefs -3.5", "Lakers ML", "Bills/Dolphins Over 44.5", "Patrick Mahomes Over 2.5 Pass TDs",
  "opponent": the opposing team for a side bet, else null,
  "line": the spread, total or prop number as a string ("-3.5", "44.5", "2.5"), else null,
  "odds": American odds as an integer (-110, 130) ONLY if the post states them, else null,
  "market": "spread" | "total" | "moneyline" | "prop" | "other",
  "isProp": true for player props, else false,
  "playerName": the player's name for a prop, else null
}

Rules:
- Only picks Ed is making in THIS post. A results recap ("cashed", "went 3-1", check marks on yesterday's card), a promo, or chatter is not a pick: return {"picks": []}.
- Never invent odds, lines or sports. If a value is not in the post, use null. You may infer the sport from well-known team or player names.
- One entry per distinct bet. A parlay is one pick with market "other".
- Moneyline: bet like "Lakers ML", odds from the post if given.`

async function parseWithAI(text: string, key: string, model: string): Promise<ParsedPick[]> {
  const res = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text.slice(0, 4000) },
      ],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`AI gateway ${res.status}: ${body.slice(0, 200)}`)
  }
  const json: any = await res.json()
  const content = String(json?.choices?.[0]?.message?.content ?? '')
  // Some models wrap JSON in a fence even when asked not to.
  const raw = content.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  const parsed = JSON.parse(raw)
  const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.picks) ? parsed.picks : null
  if (!list) throw new Error('AI response had no picks array')
  return list.map(normalizePick).filter((p: ParsedPick | null): p is ParsedPick => p !== null)
}

// ---------------------------------------------------------------------------
// Validation, shared by the AI output and the admin's edits
// ---------------------------------------------------------------------------

/** A price, or null. American odds are never inside (-100, 100). */
export function toOdds(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(/^\+/, ''))
  if (!Number.isFinite(n)) return null
  const r = Math.round(n)
  return r <= -100 || r >= 100 ? r : null
}

function str(value: unknown, max = 120): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).replace(/\s+/g, ' ').trim()
  return s ? s.slice(0, max) : null
}

/** Coerce anything pick-shaped into a ParsedPick, or null when there is no bet. */
export function normalizePick(input: any): ParsedPick | null {
  const bet = str(input?.bet, 200)
  if (!bet) return null
  const market: Market = MARKETS.includes(input?.market) ? input.market : 'other'
  const isProp = input?.isProp === true || market === 'prop'
  return {
    sport: str(input?.sport, 12)?.toUpperCase() ?? null,
    bet,
    opponent: str(input?.opponent),
    line: str(input?.line, 16),
    odds: toOdds(input?.odds),
    market: isProp ? 'prop' : market,
    isProp,
    playerName: isProp ? str(input?.playerName) : null,
  }
}

// ---------------------------------------------------------------------------
// Regex fallback
// ---------------------------------------------------------------------------

// Nicknames that name exactly one team across the NFL and the NBA, so a bare
// "Chiefs -3.5" knows its league. Kept to those two leagues because adding MLB
// and NHL makes half of them ambiguous (Giants, Cardinals, Panthers, Kings,
// Rangers, Jets). College teams are left to the post's own hashtag.
const NFL_TEAMS = [
  'cardinals', 'falcons', 'ravens', 'bills', 'panthers', 'bears', 'bengals', 'browns', 'cowboys',
  'broncos', 'lions', 'packers', 'texans', 'colts', 'jaguars', 'jags', 'chiefs', 'raiders',
  'chargers', 'rams', 'dolphins', 'vikings', 'patriots', 'pats', 'saints', 'giants', 'jets',
  'eagles', 'steelers', '49ers', 'niners', 'seahawks', 'buccaneers', 'bucs', 'titans', 'commanders',
]
const NBA_TEAMS = [
  'hawks', 'celtics', 'nets', 'hornets', 'bulls', 'cavaliers', 'cavs', 'mavericks', 'mavs',
  'nuggets', 'pistons', 'warriors', 'rockets', 'pacers', 'clippers', 'lakers', 'grizzlies',
  'heat', 'bucks', 'timberwolves', 'wolves', 'pelicans', 'knicks', 'thunder', 'magic', 'sixers',
  '76ers', 'suns', 'blazers', 'trail blazers', 'kings', 'spurs', 'raptors', 'jazz', 'wizards',
]
const TEAM_SPORT = new Map<string, string>([
  ...NFL_TEAMS.map(t => [t, 'NFL'] as [string, string]),
  ...NBA_TEAMS.map(t => [t, 'NBA'] as [string, string]),
])

const SPORT_WORDS: [RegExp, string][] = [
  [/\b(?:nfl)\b/i, 'NFL'],
  [/\b(?:nba)\b/i, 'NBA'],
  [/\b(?:wnba)\b/i, 'WNBA'],
  [/\b(?:cfb|ncaaf|college football)\b/i, 'CFB'],
  [/\b(?:cbb|ncaab|ncaam|college basketball)\b/i, 'CBB'],
  [/\b(?:mlb)\b/i, 'MLB'],
  [/\b(?:nhl)\b/i, 'NHL'],
  [/\b(?:cfl)\b/i, 'CFL'],
]

// Words that make an over/under a player prop rather than a game total.
const STAT_RE = /\b(?:pts?|points?|reb|rebs|rebounds?|ast|asts|assists?|pra|p\+r\+a|threes|3pm|3s|tds?|touchdowns?|yds|yards?|pass(?:ing)?|rush(?:ing)?|rec|receptions?|receiving|catches|completions?|comp|att|attempts?|ints?|interceptions?|sacks?|tackles?|longest|stl|steals?|blk|blocks?|sog|shots?|saves?|goals?|hits?|ks|strikeouts?|bases|rbis?|runs?|outs)\b/i

// Recaps of graded picks look exactly like picks ("Chiefs -3.5 ✅"). They are
// not new picks, and queueing them would double-count a result.
const RECAP_RE = /[✅❌✔✖]|\b(?:cashed|cash(?:es)?|winner|loser|went \d+-\d+|recap|yesterday|last night)\b/i

const ODDS_RE = /\(?\s*([+-]\d{3,4})\s*\)?/
const SIDE_NUM_RE = /(?:^|\s)(o|u|over|under)\s?(\d{1,3}(?:\.\d)?)(?=\s|$)/i
const MATCHUP_SPLIT_RE = /\s*(?:\/|\bvs\.?\b|\bv\b|@)\s*/i

function sportOfText(text: string): string | null {
  for (const [re, sport] of SPORT_WORDS) if (re.test(text)) return sport
  return null
}

function sportOfTeam(team: string | null): string | null {
  if (!team) return null
  const words = team.toLowerCase().split(/\s+/)
  // Last word first ("Kansas City Chiefs"), then the last two ("Trail Blazers").
  return TEAM_SPORT.get(words.slice(-2).join(' ')) ?? TEAM_SPORT.get(words[words.length - 1]) ?? null
}

function titleCase(s: string): string {
  return s.replace(/\b([a-z])/g, c => c.toUpperCase())
}

/** Strip what is never part of a pick: links, hashtags' #, emoji, unit sizes, filler. */
function cleanLine(raw: string): string {
  return raw
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[−–—]/g, '-')            // unicode minus and dashes
    .replace(/#(\w+)/g, '$1')
    .replace(/\(?\b\d+(?:\.\d+)?\s?u(?:nits?)?\b\)?/gi, ' ') // "2u", "(1.5 units)"
    .replace(/[^\x20-\x7E]/g, ' ')                    // emoji and other symbols
    .replace(/^\s*(?:[-*•>]+|\d+[.)])\s+/, '')    // list bullets
    .replace(/\b(?:play|pick(?!'?em)|lock|potd|bol|lfg|hammer|tail|fade)\b:?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Pull the price out of a line, wherever it sits ("Bears +7 (-115) vs Packers"
 * as well as "Chiefs -3.5 -110"). Safe to look anywhere because a three or
 * four digit signed number is never a spread, a total or a prop line. The last
 * one wins, which is the price when a post writes both "-3.5 -110".
 */
function takeOdds(line: string): { rest: string; odds: number | null } {
  const re = new RegExp(`(?:^|\\s)${ODDS_RE.source}(?=\\s|$)`, 'g')
  let last: RegExpExecArray | null = null
  for (let m = re.exec(line); m; m = re.exec(line)) last = m
  if (!last) return { rest: line, odds: null }
  const rest = (line.slice(0, last.index) + ' ' + line.slice(last.index + last[0].length)).replace(/\s+/g, ' ').trim()
  return { rest, odds: toOdds(last[1]) }
}

/** Pull "vs Broncos" / "@ Broncos" off the end. */
function takeOpponent(line: string): { rest: string; opponent: string | null } {
  const m = line.match(/\s(?:vs\.?|v|@|against)\s+([A-Za-z0-9 .&']{2,40})$/i)
  if (!m) return { rest: line, opponent: null }
  return { rest: line.slice(0, m.index).trim(), opponent: m[1].trim() }
}

function isTeamish(s: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9 .&']{1,40}$/.test(s) && s.split(/\s+/).length <= 4
}

function parseLine(raw: string, ctxSport: string | null): ParsedPick | null {
  if (RECAP_RE.test(raw)) return null
  let line = cleanLine(raw)
  if (!line || line.length > 90) return null

  const lineSport = sportOfText(line)
  // "NFL: Chiefs -3.5" -- drop a leading league tag once noted.
  line = line.replace(/^(?:nfl|nba|wnba|cfb|ncaaf|cbb|ncaab|mlb|nhl|cfl)\b\s*:?\s*/i, '')

  const { rest: noOdds, odds } = takeOdds(line)
  const sideNum = noOdds.match(SIDE_NUM_RE)

  // Over/under: a player prop when a stat word follows, a game total otherwise.
  if (sideNum && sideNum.index !== undefined) {
    const side = /^o/i.test(sideNum[1]) ? 'Over' : 'Under'
    const num = sideNum[2]
    const before = noOdds.slice(0, sideNum.index).trim()
    const after = noOdds.slice(sideNum.index + sideNum[0].length).trim()

    if (STAT_RE.test(after) && before && !sportOfTeam(before)) {
      const player = titleCase(before)
      const stat = titleCase(after.replace(/\s+/g, ' '))
      return {
        sport: lineSport ?? ctxSport,
        bet: `${player} ${side} ${num} ${stat}`,
        opponent: null, line: num, odds,
        market: 'prop', isProp: true, playerName: player,
      }
    }

    const matchup = [before, after].filter(Boolean).join(' ').trim()
    const teams = matchup ? matchup.split(MATCHUP_SPLIT_RE).filter(Boolean) : []
    if (teams.length > 2 || teams.some(t => !isTeamish(t))) return null
    const label = teams.length ? teams.map(titleCase).join('/') : ''
    // A bare "o44.5" with nothing to say which game is not a pick anyone can grade.
    if (!label) return null
    return {
      sport: lineSport ?? sportOfTeam(teams[0] ?? null) ?? sportOfTeam(teams[1] ?? null) ?? ctxSport,
      bet: `${label} ${side} ${num}`,
      opponent: null, line: num, odds,
      market: 'total', isProp: false, playerName: null,
    }
  }

  const { rest: subject, opponent } = takeOpponent(noOdds)

  // Moneyline: "Lakers ML +130" (the price was taken above).
  const ml = subject.match(/^(.+?)\s+(?:ml|moneyline|money line)$/i)
  if (ml && isTeamish(ml[1])) {
    const team = titleCase(ml[1].trim())
    return {
      sport: lineSport ?? sportOfTeam(team) ?? ctxSport,
      bet: `${team} ML`, opponent, line: null, odds,
      market: 'moneyline', isProp: false, playerName: null,
    }
  }

  // Spread: "Chiefs -3.5", "Bears +7 (-115)", "Duke PK".
  const sp = subject.match(/^(.+?)\s+([+-]\d{1,2}(?:\.5)?|pk|pick'?em)$/i)
  if (sp && isTeamish(sp[1])) {
    const team = titleCase(sp[1].trim())
    const num = /^p/i.test(sp[2]) ? 'PK' : sp[2]
    return {
      sport: lineSport ?? sportOfTeam(team) ?? ctxSport,
      bet: `${team} ${num}`, opponent, line: num, odds,
      market: 'spread', isProp: false, playerName: null,
    }
  }

  // A team and a plus price with nothing else is a moneyline ("Jets +240").
  if (odds !== null && isTeamish(subject) && sportOfTeam(subject)) {
    const team = titleCase(subject)
    return {
      sport: lineSport ?? sportOfTeam(team) ?? ctxSport,
      bet: `${team} ML`, opponent, line: null, odds,
      market: 'moneyline', isProp: false, playerName: null,
    }
  }

  return null
}

export function parseWithRegex(text: string): ParsedPick[] {
  const postSport = sportOfText(text)
  let headerSport: string | null = null
  const out: ParsedPick[] = []

  // One pick per line is how cards are written. A single-line post with
  // several picks separated by commas or pipes gets split the same way.
  const lines = text.split(/\r?\n|\s\|\s|;\s/)
  for (const raw of lines) {
    const trimmed = cleanLine(raw)
    if (!trimmed) continue
    // A line that is only a league name ("NFL", "🏀 NBA card") sets the sport
    // for the lines under it.
    const only = sportOfText(trimmed)
    if (only && trimmed.replace(/\b(?:card|plays?|picks?|tonight|today)\b/gi, '').trim().split(/\s+/).length <= 1) {
      headerSport = only
      continue
    }
    const pick = parseLine(raw, headerSport ?? postSport)
    if (pick) out.push(pick)
  }
  return out
}
