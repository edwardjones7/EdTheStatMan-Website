import { LIVE_SPORTS, type LiveSport } from '@/lib/live/types'
import { loadInjuries, type InjuryReport, type Injury } from '@/lib/feeds/injuries'
import { loadNews } from '@/lib/feeds/news'
import { loadLiveFeed } from '@/lib/live/scoreboard'
import '@/styles/game-intel.css'

interface Props {
  sport: string
  gameId: string
  status: string
  homeTeam: string
  awayTeam: string
  homeAbbrev: string
  awayAbbrev: string
}

function when(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
}

/**
 * Free context on a Desk game page: both teams' injury reports, the kickoff
 * forecast for outdoor football, and recent headlines about either team.
 * Public data only (ESPN, NWS), cached upstream; shown to every reader.
 */
export default async function GameIntel(p: Props) {
  if (!(LIVE_SPORTS as readonly string[]).includes(p.sport)) return null
  const sport = p.sport as LiveSport
  const upcoming = p.status === 'pre'

  const [injuries, news, live] = await Promise.all([
    upcoming ? loadInjuries(sport) : Promise.resolve({} as InjuryReport),
    loadNews(sport, 30),
    upcoming && (sport === 'nfl' || sport === 'cfb') ? loadLiveFeed([sport]) : Promise.resolve(null),
  ])

  const teams = [
    { abbrev: p.awayAbbrev, name: p.awayTeam, list: injuries[p.awayTeam] ?? [] },
    { abbrev: p.homeAbbrev, name: p.homeTeam, list: injuries[p.homeTeam] ?? [] },
  ].filter(t => t.list.length > 0)
  const weather = live?.games.find(g => g.id === p.gameId)?.weather ?? null
  const stories = news
    .filter(n => n.teams.includes(p.homeTeam) || n.teams.includes(p.awayTeam))
    .slice(0, 4)

  if (teams.length === 0 && !weather && stories.length === 0) return null

  return (
    <section className="game-intel reveal" aria-label="Injuries, weather and news">
      <h2 className="game-intel__title">Before {sport === 'nba' || sport === 'cbb' ? 'tip-off' : 'kickoff'}</h2>

      {weather && (
        <p className="game-intel__wx">
          <b>Forecast</b>
          {[
            weather.tempF != null ? `${weather.tempF}°F` : null,
            weather.windMph != null ? `wind ${weather.windMph} mph` : null,
            weather.sky,
            weather.precipPct != null && weather.precipPct >= 20 ? `${weather.precipPct}% chance of precipitation` : null,
          ].filter(Boolean).join(' · ')}
        </p>
      )}

      {teams.length > 0 && (
        <div className="game-intel__inj">
          {teams.map(t => (
            <div key={t.abbrev}>
              <h3>{t.name}</h3>
              <ul>
                {t.list.slice(0, 8).map((i: Injury) => (
                  <li key={i.name}>
                    <span className={`game-intel__st game-intel__st--${String(i.status).toLowerCase().replace(/[^a-z]/g, '')}`}>{i.status}</span>
                    <span><b>{i.name}</b>{i.pos ? ` ${i.pos}` : ''}{i.note && <small>{i.note}</small>}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {stories.length > 0 && (
        <div className="game-intel__news">
          <h3>In the news</h3>
          <ul>
            {stories.map(n => (
              <li key={n.id}>
                <a href={n.url} target="_blank" rel="noopener noreferrer"><b>{n.headline}</b></a>
                <small>{when(n.published)} · via ESPN</small>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="game-intel__src">Injuries and news via ESPN{weather ? '; forecast via the National Weather Service or ESPN' : ''}.</p>
    </section>
  )
}
