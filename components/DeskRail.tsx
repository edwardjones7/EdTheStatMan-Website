import Link from 'next/link'
import NextUp from './live/NextUp'
import type { DeskMover } from '@/lib/desk-band'

interface UpNext {
  key: string
  href: string
  matchup: string
  when: string
  line: string | null
}

interface Props {
  movers: DeskMover[]
  upNext: UpNext[]
  /** "Week 11", "Wild Card", or a basketball week label. */
  weekLabel: string | null
}

/**
 * The Desk's side rail: the countdown to the next kickoff in this league (from
 * the shared live feed), then the week's biggest line moves. A week where
 * nothing has moved yet shows what is up next instead, so the rail is never a
 * card of nothing.
 */
export default function DeskRail({ movers, upNext, weekLabel }: Props) {
  return (
    <>
      <NextUp />
      {movers.length > 0 ? (
        <section className="front-card dk-rail-card">
          <header className="front-hd">
            <h2>Line movers</h2>
            {weekLabel && <span className="dk-rail-card__note">{weekLabel} · since open</span>}
          </header>
          <ul className="front-list">
            {movers.map(m => (
              <li key={m.key}>
                <Link href={m.href} className="front-mv">
                  <span className="front-pick"><b>{m.matchup}</b><small>{m.detail}</small></span>
                  <span className={`front-mv__n front-mv__n--${m.tone}`}>{m.value}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : upNext.length > 0 ? (
        <section className="front-card dk-rail-card">
          <header className="front-hd">
            <h2>Up next</h2>
            {weekLabel && <span className="dk-rail-card__note">{weekLabel}</span>}
          </header>
          <ul className="front-list">
            {upNext.map(g => (
              <li key={g.key}>
                <Link href={g.href} className="front-mv">
                  <span className="front-pick"><b>{g.matchup}</b><small>{g.when}</small></span>
                  {g.line && <span className="front-mv__n front-mv__n--move dk-rail-card__line">{g.line}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}
