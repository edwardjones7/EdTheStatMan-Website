import type { Metadata } from 'next'
import Link from 'next/link'
import { loadWire, type WireItem } from '@/lib/wire'
import { loadUpcoming } from '@/lib/feeds/upcoming'
import { teamLogoUrl } from '@/lib/logos'
import { LIVE_SPORTS, LIVE_SPORT_LABEL, type LiveSport } from '@/lib/live/types'
import '@/styles/wire.css'

export const metadata: Metadata = {
  title: 'The Wire — Injuries, Line Moves & Game Previews',
  description: 'Injury designations, line moves and game previews for the NFL, college football, NBA and college basketball, with the betting market attached to every story.',
  alternates: { canonical: 'https://edthestatman.com/news' },
}

function ago(iso: string | null, now: number): string | null {
  if (!iso) return null
  const diff = now - Date.parse(iso)
  if (diff < 0) return null
  const m = Math.round(diff / 60000)
  if (m < 60) return `${Math.max(1, m)}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}

function Logo({ sport, abbrev, size }: { sport: string; abbrev: string; size: number }) {
  const src = teamLogoUrl(sport, abbrev)
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={abbrev} width={size} height={size} loading="lazy" className="wire-logo" />
    : <span className="wire-logo wire-logo--txt" style={{ width: size, height: size }}>{abbrev}</span>
}

function Art({ w, size }: { w: WireItem; size: number }) {
  return (
    <span className="wire-art">
      {/* Stock atmosphere, softened so a jersey or venue in it is never read as
          this game; the logos carry what the story is about. */}
      <span className="wire-art__img" style={{ backgroundImage: `url(${w.image})` }} />
      <span className="wire-art__shade" />
      <span className="wire-art__teams">
        <Logo sport={w.sport} abbrev={w.awayAbbrev} size={size} />
        <span className="wire-art__at">@</span>
        <Logo sport={w.sport} abbrev={w.homeAbbrev} size={size} />
      </span>
      <span className={`wire-art__kind wire-art__kind--${w.kind}`}>{w.kind === 'injury' ? 'Injury' : 'Line move'}</span>
    </span>
  )
}

function Chips({ w }: { w: WireItem }) {
  return (
    <span className="wire-chips">
      {w.chips.map((c, i) => <span key={i} className={`wire-chip wire-chip--${c.tone}`}>{c.label}</span>)}
    </span>
  )
}

export default async function WirePage({ searchParams }: { searchParams: { sport?: string } }) {
  const sport = (LIVE_SPORTS as readonly string[]).includes(searchParams.sport ?? '') ? (searchParams.sport as LiveSport) : null
  const [wire, upcoming] = await Promise.all([loadWire(), loadUpcoming(sport ? [sport] : [...LIVE_SPORTS], 3)])
  const all = (sport ? wire.filter(w => w.sport === sport) : wire).slice(0, 37)
  const featured = all.length > 0 ? [...all].sort((a, b) => b.weight - a.weight)[0] : null
  const rest = all.filter(w => w !== featured)
  const previews = upcoming
    .filter(g => g.status === 'pre' && (g.spread_current != null || g.total_current != null))
    .slice(0, 12)
  const now = Date.now()

  return (
    <main className="wire">
      <div className="container wire__inner">
        <header className="wire__hd">
          <div>
            <h1>The Wire</h1>
            <p>Injuries and line moves, with the number attached.</p>
          </div>
          <nav className="wire__tabs" aria-label="League">
            <Link href="/news" className={!sport ? 'is-on' : undefined}>All</Link>
            {LIVE_SPORTS.map(s => (
              <Link key={s} href={`/news?sport=${s}`} className={sport === s ? 'is-on' : undefined}>{LIVE_SPORT_LABEL[s]}</Link>
            ))}
          </nav>
        </header>

        {!featured ? (
          <p className="wire__empty">Quiet right now. Injury news and line moves land here as the week fills in.</p>
        ) : (
          <>
            <Link href={featured.href} className="wire-feature">
              <Art w={featured} size={84} />
              <span className="wire-feature__body">
                <span className="wire-kicker"><span className="front-tag">{featured.sportLabel}</span>{featured.kicker}</span>
                <span className="wire-feature__title">{featured.headline}</span>
                <Chips w={featured} />
                <span className="wire-foot">{featured.when}{ago(featured.at, now) ? ` · ${ago(featured.at, now)}` : ''}</span>
              </span>
            </Link>

            <ul className="wire-grid">
              {rest.map(w => (
                <li key={w.id}>
                  <Link href={w.href} className="wire-card">
                    <Art w={w} size={46} />
                    <span className="wire-card__body">
                      <span className="wire-kicker"><span className="front-tag">{w.sportLabel}</span>{w.kicker}</span>
                      <span className="wire-card__title">{w.headline}</span>
                      <Chips w={w} />
                      <span className="wire-foot">{w.when}{ago(w.at, now) ? ` · ${ago(w.at, now)}` : ''}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {previews.length > 0 && (
          <section className="wire-prev" aria-label="Game previews">
            <h2>Game previews</h2>
            <ul>
              {previews.map(g => (
                <li key={g.id}>
                  <Link href={g.href}>
                    <span className="wire-prev__teams">
                      <Logo sport={g.sport} abbrev={g.away_abbrev} size={28} />
                      <Logo sport={g.sport} abbrev={g.home_abbrev} size={28} />
                    </span>
                    <span className="wire-prev__txt">
                      <b>{g.away_abbrev} at {g.home_abbrev}</b>
                      <small>{LIVE_SPORT_LABEL[g.sport]} · {g.kickoff ? new Date(g.kickoff).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : 'TBD'}</small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="wire__src">Injury designations via ESPN. Stories written by EdTheStatMan.com from the data.</p>
      </div>
    </main>
  )
}
