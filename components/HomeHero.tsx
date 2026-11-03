import Image from 'next/image'
import Link from 'next/link'
import type { BoardBet, BoardRow, HomeBoard } from '@/lib/home-board'
import { TRIAL_DAYS } from '@/lib/offer'
import HomeTrialButton from './HomeTrialButton'
import { IconLock } from './Icons'

/**
 * The homepage hero, built for a cold visitor from X. In reading order:
 *
 *   1. what is on the card right now (the hook),
 *   2. the slogan and description (admin-editable site_content.hero),
 *   3. the one action, worded around that card when there is one,
 *   4. the record, so "does it win?" is answered before the scroll.
 *
 * The live board is its own section straight after (HomeBoardSection): inside
 * the hero it doubled the height and pushed everything else down the page.
 *
 * Server component; every figure arrives already shaped. The stadium photo
 * from the old hero sits behind it, greyscale and dark, so colour on the page
 * still only ever means brand or result.
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

/** Today's card, reduced to what the hook line needs. */
export interface HeroCard {
  isToday: boolean
  total: number
  locked: number
  sports: string[]
}

/** One figure in the proof line, e.g. NFL this season 24-12-3 +9.8u. */
export interface HeroProof {
  label: string
  record: string
  units: string
  tone: 'up' | 'down' | 'flat'
}

const TRIAL_NOTE = 'No card needed. Nothing renews.'

function endsLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  })
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

function trialLabel(card: HeroCard | null): string {
  if (card && card.locked > 0) {
    return `See ${card.isToday ? "tonight's" : 'the'} ${card.locked === 1 ? 'play' : 'plays'} free for ${TRIAL_DAYS} days`
  }
  return `Try the Research Desk free for ${TRIAL_DAYS} days`
}

function CardHook({ card }: { card: HeroCard }) {
  return (
    <Link href="/portfolio" className="home-hook">
      <span className="home-hook__dot" aria-hidden="true" />
      <span>
        {card.isToday ? 'Tonight' : 'Latest card'}:{' '}
        <strong>{plural(card.total, 'play', 'plays')}</strong>
        {card.sports.length > 0 && <> on the {card.sports.join(', ')} card</>}
      </span>
    </Link>
  )
}

function researchLabel(r: BoardRow): string {
  return [
    r.systems > 0 && plural(r.systems, 'system', 'systems'),
    r.trends > 0 && plural(r.trends, 'trend', 'trends'),
  ].filter(Boolean).join(', ')
}

/** Open bets by name, locked ones as a count. BoardBet carries no text when locked. */
function BetsCell({ bets }: { bets: BoardBet[] }) {
  if (bets.length === 0) return <span className="is-quiet">–</span>
  const open = bets.filter(b => !b.locked)
  const locked = bets.length - open.length
  return (
    <>
      {open.slice(0, 2).map((b, i) => (
        <Link key={b.key ?? i} href={`/picks/${encodeURIComponent(b.key ?? '')}`} className="home-board__bet">
          {b.bet ?? 'Pick'}
          {b.result !== 'pending' && <span className="home-board__open"> {b.result.toUpperCase()}</span>}
        </Link>
      ))}
      {open.length > 2 && <span className="home-board__open">+{open.length - 2} more</span>}
      {locked > 0 && (
        <Link href="/win?plan=portfolio" className="home-board__locked">
          <IconLock size={12} /> {plural(locked, 'Portfolio pick', 'Portfolio picks')}
        </Link>
      )}
    </>
  )
}

function Board({ board }: { board: HomeBoard }) {
  // A column of "None yet" sells nothing and reads as an unfinished product,
  // so each one only appears once a game on screen has something to put in it.
  const showResearch = board.rows.some(r => r.systems + r.trends > 0)
  const showBets = board.rows.some(r => r.bets.length > 0)
  return (
    <div className="home-board">
      <div className="home-board__scroll" role="region" aria-label={`${board.title} lines`} tabIndex={0}>
        <table className={`home-board__table${showResearch || showBets ? ' is-wide' : ''}`}>
          <thead>
            <tr>
              <th scope="col">Game</th>
              <th scope="col" className="is-num">Spread</th>
              <th scope="col" className="is-num">Total</th>
              {showResearch && <th scope="col" className="is-num">Research</th>}
              {showBets && <th scope="col" className="is-num">Bets</th>}
            </tr>
          </thead>
          <tbody>
            {board.rows.map(r => (
              <tr key={r.id}>
                <td>
                  {r.sportTag && <span className="home-board__sport">{r.sportTag}</span>}
                  <Link href={r.href} className="home-board__game">{r.matchup}</Link>
                  <span className="home-board__when">{r.when}</span>
                </td>
                <td className="is-num is-mono">
                  <span className="home-board__line">{r.spread ?? '–'}</span>
                  {r.spreadOpen && <span className="home-board__open">opened {r.spreadOpen}</span>}
                </td>
                <td className="is-num is-mono">
                  <span className="home-board__line">{r.total ?? '–'}</span>
                  {r.totalOpen && <span className="home-board__open">opened {r.totalOpen}</span>}
                </td>
                {showResearch && (
                  <td className="is-num home-board__research">
                    {r.systems + r.trends === 0 ? (
                      <span className="is-quiet">–</span>
                    ) : r.researchOpen ? (
                      <Link href={r.href}>{researchLabel(r)}</Link>
                    ) : (
                      <Link href={r.href} className="home-board__locked">
                        <IconLock size={12} /> {researchLabel(r)}
                      </Link>
                    )}
                  </td>
                )}
                {showBets && (
                  <td className="is-num home-board__research">
                    <BetsCell bets={r.bets} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="home-board__foot">
        <Link href={board.href} className="home-board__all">
          {board.allLabel}
        </Link>
        <span className="home-board__others">
          {board.others}
        </span>
      </footer>
    </div>
  )
}

/** Today's games, with research shown as a locked count, not a blank. */
export function HomeBoardSection({ board }: { board: HomeBoard | null }) {
  if (!board || board.rows.length === 0) return null
  return (
    <section className="home-board-section" aria-labelledby="home-board-title">
      <div className="container">
        <header className="home-board-section__head">
          <span className="section-label">The Board</span>
          <h2 id="home-board-title" className="section-title">{board.title}</h2>
          <p className="home-board__count">
            {plural(board.games, 'game', 'games')}
            {board.withResearch > 0
              ? `, ${board.withResearch} with systems and trends attached.`
              : '. Systems and trends go up before game time.'}
            {board.bets > 0 && ` ${plural(board.bets, 'bet', 'bets')} posted.`}
          </p>
        </header>
        <Board board={board} />
      </div>
    </section>
  )
}

export default function HomeHero({
  cta, title, accent, description, card, proof,
}: {
  cta: HeroCta
  title: string
  accent: string
  description: string
  card: HeroCard | null
  proof: HeroProof[]
}) {
  const label = trialLabel(card)
  return (
    <section className="home-hero">
      <div className="home-hero__media" aria-hidden="true">
        <Image
          src="/images/hero-stadium.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: 'cover', objectPosition: 'center 35%' }}
        />
      </div>

      <div className="container home-hero__inner">
        <div className="home-hero__copy">
          {card && card.total > 0 && <CardHook card={card} />}

          <h1 className="home-hero__title">
            {title}{' '}
            <span className="home-hero__accent">{accent}</span>
          </h1>
          <p className="home-hero__sub">{description}</p>

          <div className="home-hero__actions">
            {cta.kind === 'desk' && (
              <Link href="/desk" className="home-btn home-btn--primary">Open tonight&rsquo;s board</Link>
            )}
            {cta.kind === 'signup' && (
              <Link
                href={`/signup?next=${encodeURIComponent('/win?trial=1#plan-desk')}`}
                className="home-btn home-btn--primary"
              >
                {label}
              </Link>
            )}
            {cta.kind === 'trial' && <HomeTrialButton label={label} />}
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

          {proof.length > 0 && (
            <Link href="/portfolio/performance" className="home-proof" aria-label="The graded record">
              {proof.map(p => (
                <span key={p.label} className="home-proof__item">
                  <span className="home-proof__label">{p.label}</span>{' '}
                  <span className="home-proof__fig">{p.record}</span>{' '}
                  <span className={`home-proof__fig is-${p.tone}`}>{p.units}</span>
                </span>
              ))}
              <span className="home-proof__label">Every pick graded in public</span>
            </Link>
          )}
        </div>
      </div>
    </section>
  )
}
