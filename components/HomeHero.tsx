import Image from 'next/image'
import Link from 'next/link'
import type { HomeBoard } from '@/lib/home-board'
import { TRIAL_DAYS } from '@/lib/offer'
import HomeTrialButton from './HomeTrialButton'
import { IconLock } from './Icons'

/**
 * The homepage hero, built for a cold visitor from X. In reading order:
 *
 *   1. what is on the card right now (the hook),
 *   2. the slogan and description (admin-editable site_content.hero),
 *   3. the one action, worded around that card when there is one,
 *   4. the record, so "does it win?" is answered before the scroll,
 *   5. the live board, with research shown as a locked count, not a blank.
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

function Board({ board, hasDesk }: { board: HomeBoard; hasDesk: boolean }) {
  // A column of "None yet" sells nothing and reads as an unfinished product,
  // so it only appears once at least one game on screen carries research.
  const showResearch = board.withResearch > 0
  return (
    <section className="home-board" aria-labelledby="home-board-title">
      <header className="home-board__head">
        <h2 id="home-board-title" className="home-board__title">{board.title}</h2>
        <span className="home-board__count">
          {plural(board.games, 'game', 'games')}
          {showResearch
            ? `, ${board.withResearch} with systems and trends attached`
            : '. Systems and trends go up before game time.'}
        </span>
      </header>
      <div className="home-board__scroll" role="region" aria-label={`${board.title} lines`} tabIndex={0}>
        <table className="home-board__table">
          <thead>
            <tr>
              <th scope="col">Game</th>
              <th scope="col" className="is-num">Spread</th>
              <th scope="col" className="is-num">Total</th>
              {showResearch && <th scope="col" className="is-num">Research</th>}
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
                    {r.research === 0 ? (
                      <span className="is-quiet">–</span>
                    ) : hasDesk ? (
                      <Link href={r.href}>{plural(r.research, 'system or trend', 'systems and trends')}</Link>
                    ) : (
                      <Link href={r.href} className="home-board__locked">
                        <IconLock size={12} /> {plural(r.research, 'system or trend', 'systems and trends')}
                      </Link>
                    )}
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
    </section>
  )
}

export default function HomeHero({
  board, cta, title, accent, description, card, proof,
}: {
  board: HomeBoard | null
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

        {board && board.rows.length > 0 && <Board board={board} hasDesk={cta.kind === 'desk'} />}
      </div>
    </section>
  )
}
