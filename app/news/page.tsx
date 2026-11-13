import type { Metadata } from 'next'
import Link from 'next/link'
import { loadWire } from '@/lib/wire'
import { loadUpcoming } from '@/lib/feeds/upcoming'
import { LIVE_SPORTS, LIVE_SPORT_LABEL, type LiveSport } from '@/lib/live/types'
import '@/styles/wire.css'

export const metadata: Metadata = {
  title: 'The Wire — Injuries, Line Moves & Game Previews',
  description: 'Injury designations, line moves and game previews for the NFL, college football, NBA and college basketball, with the betting market attached to every item.',
  alternates: { canonical: 'https://edthestatman.com/news' },
}

function ago(iso: string | null, now: number): string {
  if (!iso) return ''
  const diff = now - Date.parse(iso)
  if (diff < 0) {
    return new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
  }
  const m = Math.round(diff / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

export default async function WirePage({ searchParams }: { searchParams: { sport?: string } }) {
  const sport = (LIVE_SPORTS as readonly string[]).includes(searchParams.sport ?? '') ? (searchParams.sport as LiveSport) : null
  const [wire, upcoming] = await Promise.all([loadWire(), loadUpcoming(sport ? [sport] : [...LIVE_SPORTS], 3)])
  const items = (sport ? wire.filter(w => w.sport === sport) : wire).slice(0, 60)
  const previews = upcoming
    .filter(g => g.status === 'pre' && (g.spread_current != null || g.total_current != null))
    .slice(0, 24)
  const now = Date.now()

  return (
    <main className="wire">
      <div className="container wire__inner">
        <header className="wire__hd">
          <h1>The Wire</h1>
          <p>Injury designations and line moves on the games coming up, with the market attached. Every item opens the game on the Research Desk.</p>
          <nav className="wire__tabs" aria-label="League">
            <Link href="/news" className={!sport ? 'is-on' : undefined}>All</Link>
            {LIVE_SPORTS.map(s => (
              <Link key={s} href={`/news?sport=${s}`} className={sport === s ? 'is-on' : undefined}>{LIVE_SPORT_LABEL[s]}</Link>
            ))}
          </nav>
        </header>

        <div className="wire__grid">
          <section aria-label="Latest">
            {items.length === 0 ? (
              <p className="wire__empty">Nothing on the wire right now. Injury designations and line moves land here as the week fills in.</p>
            ) : (
              <ul className="wire__list">
                {items.map(w => (
                  <li key={w.id}>
                    <Link href={w.href} className="wire__item">
                      <span className="wire__meta">
                        <span className="front-tag">{w.sportLabel}</span>
                        <span className={`wire__kind wire__kind--${w.kind}`}>{w.kind === 'injury' ? 'Injury' : 'Line move'}</span>
                        <span>{ago(w.at, now)}</span>
                      </span>
                      <b>{w.headline}</b>
                      <span className="wire__body">{w.body}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="wire__side" aria-label="Game previews">
            <h2>Game previews</h2>
            <p>Form, the market, injuries and the forecast for every game in the next three days.</p>
            <ul>
              {previews.map(g => (
                <li key={g.id}>
                  <Link href={g.href}>
                    <span className="front-tag">{LIVE_SPORT_LABEL[g.sport]}</span>
                    <b>{g.away_abbrev} at {g.home_abbrev}</b>
                    <small>{g.kickoff ? new Date(g.kickoff).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : 'TBD'}</small>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        </div>
        <p className="wire__src">Injury designations via ESPN; lines via the Research Desk. Briefs are written by EdTheStatMan.com from that data.</p>
      </div>
    </main>
  )
}
