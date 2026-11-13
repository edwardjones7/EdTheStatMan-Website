import Link from 'next/link'
import type { InjuryGame } from '@/lib/home-feeds'
import type { MatchupNotes } from '@/lib/home-notes'
import { LIVE_SPORT_LABEL } from '@/lib/live/types'

/** Games in the next three days with a key player out or doubtful. */
export function InjuryCard({ games }: { games: InjuryGame[] }) {
  if (games.length === 0) return null
  return (
    <section className="front-card">
      <header className="front-hd"><h2>Injury report</h2><span className="front-dim front-hd__note">Out &amp; doubtful</span></header>
      <ul className="front-list">
        {games.map(g => (
          <li key={g.id} className="front-inj">
            <Link href={g.href} className="front-inj__game">
              <span className="front-tag">{LIVE_SPORT_LABEL[g.sport]}</span>
              <b>{g.matchup}</b>
              <small>{g.when}</small>
            </Link>
            <ul className="front-inj__list">
              {g.players.map(p => (
                <li key={`${p.team}-${p.name}`} title={p.note ?? undefined}>
                  <span className={`front-inj__st front-inj__st--${p.status.toLowerCase()}`}>{p.status === 'Doubtful' ? 'DBT' : 'OUT'}</span>
                  <span>{p.team} {p.pos} <b>{p.name}</b></span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="front-src">Injury data via ESPN.</p>
    </section>
  )
}

/** Facts about this week's games, computed from the Desk's own data. */
export function NotesCard({ games, href }: { games: MatchupNotes[]; href: string }) {
  if (games.length === 0) return null
  return (
    <section className="front-card">
      <header className="front-hd"><h2>Matchup notes</h2><Link href={href}>Full board</Link></header>
      <div className="front-notes">
        {games.map(g => (
          <Link key={g.id} href={g.href} className="front-note">
            <span className="front-note__hd"><b>{g.matchup}</b><small>{g.when}</small></span>
            <ul>
              {g.notes.map((n, i) => <li key={i} className={`front-note__i front-note__i--${n.tone}`}>{n.text}</li>)}
            </ul>
          </Link>
        ))}
      </div>
    </section>
  )
}
