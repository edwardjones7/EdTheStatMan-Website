import Link from 'next/link'
import type { HomeBoard, BoardRow } from '@/lib/home-board'
import { TRIAL_DAYS } from '@/lib/offer'
import HomeTrialButton from './HomeTrialButton'

/**
 * The homepage hero: the promise on the left, the actual board on the right.
 *
 * Server component. The board is lib/home-board.ts, already shaped into
 * display strings; nothing here computes a number.
 *
 * The primary button depends on who is looking:
 *   desk       holds the Desk (paid, trial or admin)   -> open the board
 *   signup     logged out                              -> signup, then the trial
 *   trial      signed in and may start the trial       -> POST /api/trial
 *   plans      signed in, trial used, no Desk          -> /win
 */
export type HeroCta =
  | { kind: 'desk'; trialEndsAt?: string | null }
  | { kind: 'signup' }
  | { kind: 'trial' }
  | { kind: 'plans'; expired: boolean }

const TRIAL_LABEL = `Try the Research Desk free for ${TRIAL_DAYS} days`
const TRIAL_NOTE = 'No card needed. Nothing renews.'

function endsLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  })
}

function Move({ m }: { m: BoardRow['spreadMove'] }) {
  if (!m) return null
  return <span className={`home-board__move is-${m.tone}`}>{m.label}</span>
}

function Board({ board }: { board: HomeBoard }) {
  return (
    <section className="home-board" aria-labelledby="home-board-title">
      <header className="home-board__head">
        <h2 id="home-board-title" className="home-board__title">{board.title}</h2>
        <span className="home-board__count">
          {board.games} {board.games === 1 ? 'game' : 'games'}
          {board.withResearch > 0
            ? `, ${board.withResearch} with research`
            : ', research goes up before kickoff'}
        </span>
      </header>
      <div className="home-board__scroll" role="region" aria-label={`${board.title} lines`} tabIndex={0}>
        <table className="home-board__table">
          <thead>
            <tr>
              <th scope="col">Game</th>
              <th scope="col" className="is-num">Spread</th>
              <th scope="col" className="is-num">Total</th>
              <th scope="col" className="is-num">Research</th>
            </tr>
          </thead>
          <tbody>
            {board.rows.map(r => (
              <tr key={r.id}>
                <td>
                  <Link href={r.href} className="home-board__game">{r.matchup}</Link>
                  <span className="home-board__when">{r.when}</span>
                </td>
                <td className="is-num is-mono">
                  <span className="home-board__line">{r.spread ?? '–'}</span>
                  <Move m={r.spreadMove} />
                </td>
                <td className="is-num is-mono">
                  <span className="home-board__line">{r.total ?? '–'}</span>
                  <Move m={r.totalMove} />
                </td>
                <td className="is-num home-board__research">
                  {r.research > 0
                    ? <>{r.research} {r.research === 1 ? 'system or trend' : 'systems/trends'}</>
                    : <span className="is-quiet">None yet</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="home-board__foot">
        <Link href={board.href} className="home-board__all">
          The full {board.sportLabel} board
        </Link>
        <span className="home-board__others">
          College football, NBA and college basketball are on the Desk too.
        </span>
      </footer>
    </section>
  )
}

export default function HomeHero({ board, cta }: { board: HomeBoard | null; cta: HeroCta }) {
  return (
    <section className="home-hero">
      <div className="container home-hero__inner">
        <div className="home-hero__copy">
          <h1 className="home-hero__title">Tonight&rsquo;s board, already researched.</h1>
          <p className="home-hero__sub">
            Every NFL, college football, NBA and college basketball game with its line,
            the systems and trends that fit it, and the bets Ed is making. Every pick
            graded in public.
          </p>
          <div className="home-hero__actions">
            {cta.kind === 'desk' && (
              <Link href="/desk" className="home-btn home-btn--primary">Open tonight&rsquo;s board</Link>
            )}
            {cta.kind === 'signup' && (
              <Link
                href={`/signup?next=${encodeURIComponent('/win?trial=1#plan-desk')}`}
                className="home-btn home-btn--primary"
              >
                {TRIAL_LABEL}
              </Link>
            )}
            {cta.kind === 'trial' && <HomeTrialButton label={TRIAL_LABEL} />}
            {cta.kind === 'plans' && (
              <Link href="/win" className="home-btn home-btn--primary">
                {cta.expired ? 'Renew your access' : 'See membership'}
              </Link>
            )}
            <Link href="/portfolio/performance" className="home-btn home-btn--outline">See the record</Link>
          </div>
          {(cta.kind === 'signup' || cta.kind === 'trial') && (
            <p className="home-hero__note">{TRIAL_NOTE}</p>
          )}
          {cta.kind === 'desk' && cta.trialEndsAt && (
            <p className="home-hero__note">Your free trial runs until {endsLabel(cta.trialEndsAt)}.</p>
          )}
        </div>

        {board && board.rows.length > 0 && <Board board={board} />}
      </div>
    </section>
  )
}
