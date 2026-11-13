// Matchup notes: short, factual blurbs about this week's games, written from
// the Desk's own data. Original content (no one else has these numbers in this
// form), and it shows the Vault working without giving rows away.
//
// Every note is a plain fact computed here; nothing is generated text. A game
// needs at least two notes to be shown, so the card is never padded with filler.

import { createCachedClient, DB_TAGS } from './supabase/cached'
import { selectAll } from './supabase/select-all'
import { latestPublishedSeason } from './desk-teams'
import { currentWeekOf, gamePath, gameIsPlayed, spreadLabel } from './nfl'
import { rowMinTier } from './gate'
import { loadInjuries, isKeyPosition } from './feeds/injuries'
import { loadLiveFeed } from './live/scoreboard'

const SPORT = 'nfl'

export interface MatchupNote {
  text: string
  tone: 'up' | 'down' | 'info' | 'warn'
  /** Higher shows first; only the top four make the card. */
  weight?: number
}

export interface MatchupNotes {
  id: string
  href: string
  matchup: string
  when: string
  notes: MatchupNote[]
}

interface Row {
  id: string
  slug: string
  season_type: number
  week: number
  kickoff: string | null
  status: string
  home_team: string
  away_team: string
  home_abbrev: string
  away_abbrev: string
  home_score: number | null
  away_score: number | null
  spread_open: number | null
  spread_current: number | null
  total_open: number | null
  total_current: number | null
}

function mascot(team: string): string {
  const parts = team.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : team
}

function fmt(n: number): string {
  const r = Math.round(n * 10) / 10
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('-', '−')
}

interface TeamLine { aw: number; al: number; ap: number; over: number; under: number }

function records(rows: Row[]): Map<string, TeamLine> {
  const m = new Map<string, TeamLine>()
  const get = (t: string) => m.get(t) ?? (m.set(t, { aw: 0, al: 0, ap: 0, over: 0, under: 0 }), m.get(t)!)
  for (const g of rows) {
    if (g.status !== 'post' || g.home_score == null || g.away_score == null) continue
    if (g.spread_current != null) {
      const margin = g.home_score - g.away_score + g.spread_current
      const h = get(g.home_abbrev), a = get(g.away_abbrev)
      if (margin > 0) { h.aw++; a.al++ } else if (margin < 0) { h.al++; a.aw++ } else { h.ap++; a.ap++ }
    }
    if (g.total_current != null) {
      const pts = g.home_score + g.away_score
      for (const t of [g.home_abbrev, g.away_abbrev]) {
        if (pts > g.total_current) get(t).over++
        else if (pts < g.total_current) get(t).under++
      }
    }
  }
  return m
}

const MIN_GAMES = 5

/** Most decision-relevant first: injuries, weather, market moves, then records. */
function rank(notes: MatchupNote[]): MatchupNote[] {
  const w = (n: MatchupNote) =>
    /QB/.test(n.text) ? 6 : /^Kickoff forecast/.test(n.text) ? 5 : n.tone === 'warn' ? 4 :
    /moved|since it opened/.test(n.text) ? 3 : /ATS/.test(n.text) ? 2 : /Vault/.test(n.text) ? 1.5 : 1
  return [...notes].sort((a, b) => w(b) - w(a))
}
const HOT = 0.7

export async function loadMatchupNotes(now: Date = new Date(), limit = 6): Promise<MatchupNotes[]> {
  try {
    const db = createCachedClient([DB_TAGS.games]) as any
    const season = await latestPublishedSeason(db, SPORT)
    const { data: all } = await selectAll<Row>(() => db
      .from('nfl_games')
      .select('id, slug, season_type, week, kickoff, status, home_team, away_team, home_abbrev, away_abbrev, home_score, away_score, spread_open, spread_current, total_open, total_current')
      .eq('sport', SPORT).eq('season', season).eq('is_published', true)
      .order('id', { ascending: true }))
    const active = currentWeekOf(all, now)
    if (!active) return []
    const week = all.filter(g => g.season_type === active.season_type && g.week === active.week && !gameIsPlayed(g, now))
    if (week.length === 0) return []
    const rec = records(all)
    const ids = week.map(g => g.id)

    // Vault rows linked to these games, and how many are free to read.
    const vault = createCachedClient([DB_TAGS.games, DB_TAGS.vault]) as any
    const [sysLinks, trendLinks, injuries, live] = await Promise.all([
      vault.from('nfl_game_systems').select('game_id, system_id').in('game_id', ids),
      vault.from('nfl_game_trends').select('game_id, trend_id').in('game_id', ids),
      loadInjuries('nfl'),
      loadLiveFeed(['nfl']),
    ])
    const sysIds = Array.from(new Set(((sysLinks?.data ?? []) as any[]).map(r => r.system_id)))
    const trendIds = Array.from(new Set(((trendLinks?.data ?? []) as any[]).map(r => r.trend_id)))
    const [sysRows, trendRows] = await Promise.all([
      sysIds.length ? vault.from('betting_systems').select('*').in('id', sysIds).eq('is_active', true) : { data: [] },
      trendIds.length ? vault.from('betting_trends').select('*').in('id', trendIds).eq('is_active', true) : { data: [] },
    ])
    const free = new Set<string>()
    const active_ = new Set<string>()
    for (const r of [...(sysRows?.data ?? []), ...(trendRows?.data ?? [])] as any[]) {
      active_.add(r.id)
      if (rowMinTier(r, 'private') === 'retail') free.add(r.id)
    }
    const linked = new Map<string, { n: number; free: number }>()
    for (const r of [
      ...((sysLinks?.data ?? []) as any[]).map(x => ({ g: x.game_id, id: x.system_id })),
      ...((trendLinks?.data ?? []) as any[]).map(x => ({ g: x.game_id, id: x.trend_id })),
    ]) {
      if (!active_.has(r.id)) continue
      const c = linked.get(r.g) ?? { n: 0, free: 0 }
      c.n++
      if (free.has(r.id)) c.free++
      linked.set(r.g, c)
    }
    const liveById = new Map(live.games.filter(g => g.id).map(g => [g.id!, g]))

    const out: (MatchupNotes & { score: number; t: number })[] = []
    for (const g of week) {
      const notes: MatchupNote[] = []
      let score = 0

      for (const [abbrev, team] of [[g.away_abbrev, g.away_team], [g.home_abbrev, g.home_team]] as const) {
        const r = rec.get(abbrev)
        if (!r) continue
        const ats = r.aw + r.al
        if (ats >= MIN_GAMES && (r.aw / ats >= HOT || r.al / ats >= HOT)) {
          notes.push({ text: `${mascot(team)} are ${r.aw}-${r.al}${r.ap ? `-${r.ap}` : ''} ATS this season`, tone: r.aw > r.al ? 'up' : 'down' })
          score += 2
        }
        const ou = r.over + r.under
        if (ou >= MIN_GAMES && (r.over / ou >= HOT || r.under / ou >= HOT)) {
          notes.push({ text: r.over > r.under ? `Overs are ${r.over}-${r.under} in ${mascot(team)} games` : `Unders are ${r.under}-${r.over} in ${mascot(team)} games`, tone: 'info' })
          score += 1
        }
      }

      if (g.spread_open != null && g.spread_current != null && Math.abs(g.spread_current - g.spread_open) >= 1.5) {
        const open = spreadLabel(g.spread_open, g.home_abbrev, g.away_abbrev)
        notes.push({ text: `Spread has moved ${fmt(Math.abs(g.spread_current - g.spread_open))} pts since it opened ${open?.replace('-', '−')}`, tone: 'info' })
        score += 2
      }
      if (g.total_open != null && g.total_current != null && Math.abs(g.total_current - g.total_open) >= 2) {
        const d = g.total_current - g.total_open
        notes.push({ text: `Total ${d > 0 ? 'up' : 'down'} ${fmt(Math.abs(d))} since it opened ${g.total_open}`, tone: d > 0 ? 'up' : 'down' })
        score += 1
      }

      for (const team of [g.away_team, g.home_team]) {
        const qb = (injuries[team] ?? []).find(i => i.pos === 'QB' && (i.status === 'Out' || i.status === 'Doubtful'))
        if (qb) { notes.push({ text: `${mascot(team)} QB ${qb.name} is ${qb.status.toLowerCase()}`, tone: 'warn' }); score += 3; continue }
        const out = (injuries[team] ?? []).filter(i => i.status === 'Out' && isKeyPosition(i.pos))
        if (out.length >= 2) {
          notes.push({ text: `${mascot(team)} rule out ${out.length} at key spots (${out.slice(0, 2).map(i => `${i.pos} ${i.name.split(' ').slice(-1)[0]}`).join(', ')})`, tone: 'warn' })
          score += 1
        }
      }

      const w = liveById.get(g.id)
      if (w?.weatherFlag && w.weather) {
        const bits = [w.weather.windMph != null && w.weather.windMph >= 15 ? `wind ${w.weather.windMph} mph` : null, w.weather.sky, w.weather.tempF != null ? `${w.weather.tempF}°F` : null].filter(Boolean)
        notes.push({ text: `Kickoff forecast: ${bits.join(', ')}`, tone: 'info' })
        score += 2
      }

      const l = linked.get(g.id)
      if (l && l.n > 0) {
        notes.push({ text: `${l.n} Vault ${l.n === 1 ? 'row fits' : 'rows fit'} this game${l.free > 0 ? `, ${l.free} free to read` : ''}`, tone: 'up' })
        score += 1
      }

      if (notes.length < 2) continue
      out.push({
        id: g.id,
        href: gamePath(SPORT, g.slug),
        matchup: `${mascot(g.away_team)} at ${mascot(g.home_team)}`,
        when: g.kickoff
          ? new Date(g.kickoff).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
          : 'Time TBD',
        notes: rank(notes).slice(0, 4),
        score,
        t: g.kickoff ? Date.parse(g.kickoff) : Number.MAX_SAFE_INTEGER,
      })
    }

    return out
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .sort((a, b) => a.t - b.t)
      .map(({ score: _s, t: _t, ...rest }) => rest)
  } catch (e) {
    console.error('[home-notes] failed', e)
    return []
  }
}
