// News and injuries, shaped for the front page. Everything here is public and
// identical for every visitor; the sources are cached (lib/feeds/*).

import { LIVE_SPORTS, type LiveSport } from './live/types'
import { loadNews } from './feeds/news'
import { loadInjuries, isKeyPosition, type Injury } from './feeds/injuries'
import { loadUpcoming, findGame, type UpcomingGame } from './feeds/upcoming'
import { spreadLabel } from './nfl'

export interface NewsEntry {
  id: string
  sport: LiveSport
  headline: string
  description: string | null
  published: string | null
  url: string
  /** The Desk game the story is about, when ESPN's team tags name one. */
  game: { href: string; label: string } | null
}

export interface InjuryGame {
  id: string
  href: string
  sport: LiveSport
  matchup: string
  when: string
  players: (Injury & { team: string })[]
}

function gameLabel(g: UpcomingGame): string {
  const line = spreadLabel(g.spread_current, g.home_abbrev, g.away_abbrev)
  return `${g.away_abbrev} at ${g.home_abbrev}${line ? ` · ${line.replace('-', '−')}` : ''}`
}

function when(iso: string | null): string {
  if (!iso) return 'Time TBD'
  return new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
}

export async function loadFrontFeeds(): Promise<{ news: NewsEntry[]; injuries: InjuryGame[] }> {
  const sports = [...LIVE_SPORTS] as LiveSport[]
  const [newsLists, upcoming, nflInj, nbaInj, cfbInj] = await Promise.all([
    Promise.all(sports.map(s => loadNews(s, 10))),
    loadUpcoming(sports),
    loadInjuries('nfl'),
    loadInjuries('nba'),
    loadInjuries('cfb'),
  ])

  const news: NewsEntry[] = newsLists.flat().map(n => {
    const g = n.teams.length > 0 ? findGame(upcoming, n.sport, n.teams) : null
    return {
      id: `${n.sport}-${n.id}`,
      sport: n.sport,
      headline: n.headline,
      description: n.description,
      published: n.published,
      url: n.url,
      game: g ? { href: g.href, label: gameLabel(g) } : null,
    }
  })

  // Injury report: games in the next three days with a key player out or doubtful.
  const reports: Partial<Record<LiveSport, Record<string, Injury[]>>> = { nfl: nflInj, nba: nbaInj, cfb: cfbInj }
  const soon = Date.now() + 3 * 24 * 3600 * 1000
  const injuries: InjuryGame[] = []
  for (const g of upcoming) {
    if (g.status !== 'pre' || !g.kickoff || Date.parse(g.kickoff) > soon) continue
    const rep = reports[g.sport]
    if (!rep) continue
    const players = [g.away_team, g.home_team].flatMap(team =>
      (rep[team] ?? [])
        .filter(i => (i.status === 'Out' || i.status === 'Doubtful') && isKeyPosition(i.pos))
        .map(i => ({ ...i, team: team === g.home_team ? g.home_abbrev : g.away_abbrev }))
    )
    if (players.length === 0) continue
    injuries.push({
      id: g.id,
      href: g.href,
      sport: g.sport,
      matchup: `${g.away_abbrev} at ${g.home_abbrev}`,
      when: when(g.kickoff),
      players: players.slice(0, 3),
    })
  }

  return { news, injuries: injuries.slice(0, 6) }
}
