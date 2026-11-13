import Image from 'next/image'
import Link from 'next/link'
import type { HomeBoard } from '@/lib/home-board'
import type { Brief } from '@/lib/brief'
import { formatCardDate } from '@/lib/brief'
import type { ProofData } from '@/lib/proof'
import { BOOK_LABEL, shortDate } from '@/lib/proof'
import { minus } from '@/lib/home-board'
import { TRIAL_DAYS } from '@/lib/offer'
import {
  lineMovers, leadStory, stories, upcomingFirst, type VaultLeader,
} from '@/lib/home-front'
import type { HeroCta } from './HomeHero'
import HomeTrialButton from './HomeTrialButton'
import HomeFreeBox from './HomeFreeBox'
import LiveProvider from './live/LiveProvider'
import LiveStrip from './live/LiveStrip'
import LivePicks from './live/LivePicks'
import NextUp from './live/NextUp'
import { LiveWhen, LiveLine, JustMoved } from './live/LiveCells'
import type { PickTrack } from '@/lib/live/types'
import NewsCard from './live/NewsCard'
import { InjuryCard, NotesCard, WireCard } from './FrontExtras'
import type { WireItem } from '@/lib/wire'
import type { NewsEntry, InjuryGame } from '@/lib/home-feeds'
import type { MatchupNotes } from '@/lib/home-notes'

/**
 * The homepage as a sports front page (Nov 2026): a lines strip like a scores
 * bar, then three columns of modules. Server-rendered from data that is either
 * public (lines, moves, Vault records, the graded record) or already gated
 * (the brief drops locked picks and keeps only a count).
 */
export interface HomeFrontProps {
  board: HomeBoard | null
  brief: Brief
  proof: ProofData
  series: number[]
  leaders: VaultLeader[]
  cta: HeroCta
  signedOut: boolean
  /** Live tracking for the visible picks (lib/live/track.ts). */
  tracks: PickTrack[]
  news: NewsEntry[]
  injuries: InjuryGame[]
  notes: MatchupNotes[]
  wire: WireItem[]
}

/** Units over the headline window, on one scale from zero to a round ceiling. */
function UnitsChart({ series, last }: { series: number[]; last: number }) {
  if (series.length < 2) return null
  const W = 300, H = 120, L = 34, R = 8, T = 8, B = 20
  const lo = Math.min(0, ...series), hi = Math.max(0, ...series)
  const step = Math.max(1, Math.ceil((hi - lo) / 3))
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step || step
  const x = (i: number) => L + (i / (series.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B)
  const ticks: number[] = []
  for (let v = min; v <= max + 1e-9; v += step) ticks.push(v)
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const tone = last >= 0 ? 'var(--up)' : 'var(--down)'
  return (
    <svg className="front-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Units won pick by pick, ending at ${last >= 0 ? 'plus' : 'minus'} ${Math.abs(last)}`}>
      <defs>
        <linearGradient id="front-chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone} stopOpacity="0.3" />
          <stop offset="1" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.07)" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{v > 0 ? `+${v}u` : v < 0 ? `−${-v}u` : '0'}</text>
        </g>
      ))}
      <path d={`M${x(0)},${y(0)} L${pts.join(' L')} L${x(series.length - 1)},${y(0)} Z`} fill="url(#front-chart-fill)" />
      <polyline points={pts.join(' ')} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="4" fill={tone} />
    </svg>
  )
}

function Cta({ cta, locked, isToday }: { cta: HeroCta; locked: number; isToday: boolean }) {
  const trialLabel = locked > 0
    ? `See ${isToday ? "tonight's" : 'the'} ${locked === 1 ? 'play' : 'plays'} free for ${TRIAL_DAYS} days`
    : `Try the Research Desk free for ${TRIAL_DAYS} days`
  return (
    <section className="front-card front-cta">
      <h2 className="front-cta__title">
        {cta.kind === 'desk' ? 'Your Research Desk' : 'The Research Desk'}
      </h2>
      <p className="front-cta__sub">
        Every game, every system and every pick. The Vault and the Portfolio in one plan.
      </p>
      {cta.kind === 'desk' && <Link href="/desk" className="front-btn front-btn--primary">Open tonight&rsquo;s board</Link>}
      {cta.kind === 'signup' && (
        <Link href={`/signup?next=${encodeURIComponent('/win?trial=1#plan-desk')}`} className="front-btn front-btn--primary">{trialLabel}</Link>
      )}
      {cta.kind === 'trial' && <HomeTrialButton label={trialLabel} />}
      {cta.kind === 'plans' && (
        <Link href="/win" className="front-btn front-btn--primary">{cta.expired ? 'Renew your access' : 'See membership'}</Link>
      )}
      {(cta.kind === 'signup' || cta.kind === 'trial') && <p className="front-cta__note">No card needed. Nothing renews.</p>}
    </section>
  )
}

export default function HomeFront({ board, brief, proof, series, leaders, cta, signedOut, tracks, news, injuries, notes, wire }: HomeFrontProps) {
  const lead = leadStory(board, proof)
  const cards = stories(board, brief, lead)
  const movers = lineMovers(board)
  const rows = board ? upcomingFirst(board.rows) : []
  const h = proof.headline
  const cardLabel = brief.date ? (brief.isToday ? "Tonight's card" : 'Latest card') : "Tonight's card"

  return (
    <LiveProvider>
    <div className="front">
      <LiveStrip
        seed={rows}
        seedTitle={board?.title ?? ''}
        seedHref={board?.href ?? '/desk'}
        seedGames={board?.games ?? 0}
      />

      <div className="container front-grid">
        <aside className="front-left" aria-label="Today and the Vault">
          <section className="front-card">
            <header className="front-hd">
              <h2>{cardLabel}</h2>
              {brief.total > 0 && <Link href="/portfolio">{brief.total} {brief.total === 1 ? 'play' : 'plays'}</Link>}
            </header>
            {brief.total === 0 ? (
              <p className="front-empty">No plays posted yet. They land here the moment Ed posts them.</p>
            ) : (
              <LivePicks
                picks={brief.visible}
                tracks={tracks}
                lockedGameIds={brief.lockedGameIds}
                lockedCount={brief.lockedCount}
                lockedSports={brief.sportCounts.map(c => `${c.n} ${c.sport}`).join(' · ')}
                dateNote={brief.date && !brief.isToday ? formatCardDate(brief.date) : null}
              />
            )}
          </section>

          {movers.length > 0 && (
            <section className="front-card">
              <header className="front-hd"><h2>Line movers</h2>{board && <Link href={board.href}>Full board</Link>}</header>
              <ul className="front-list">
                {movers.map(m => (
                  <li key={m.key}>
                    <Link href={m.href} className="front-mv">
                      <span className="front-pick"><b>{m.matchup} <JustMoved gameId={m.gameId} /></b><small>{m.detail}</small></span>
                      <span className={`front-mv__n front-mv__n--${m.tone}`}>{m.value}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <WireCard items={wire} />

          <InjuryCard games={injuries} />

          {leaders.length > 0 && (
            <section className="front-card">
              <header className="front-hd"><h2>Vault leaders</h2><Link href="/vault/systems">The Vault</Link></header>
              <ul className="front-list">
                {leaders.map(v => (
                  <li key={v.code}>
                    <Link href={v.href} className="front-mv">
                      <span className="front-tag">{v.sport}</span>
                      <span className="front-pick"><b>{v.code}</b><small>{v.record}</small></span>
                      <span className="front-mv__n front-mv__n--up">{v.pct.toFixed(1)}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>

        <div className="front-main">
          <NextUp />
          {lead && (
            <Link href={lead.href} className="front-lead">
              <Image src={lead.image} alt="" fill priority sizes="(max-width: 760px) 100vw, 680px" />
              <span className="front-lead__cap">
                <span className="front-kick">{lead.kicker}</span>
                <span className="front-lead__title">{lead.title}</span>
                <span className="front-lead__dek">{lead.dek}</span>
              </span>
            </Link>
          )}

          {cards.length > 0 && (
            <div className="front-stories">
              {cards.map(s => (
                <Link key={s.key} href={s.href} className="front-story">
                  <span className="front-story__img"><Image src={s.image} alt="" fill sizes="120px" /></span>
                  <span>
                    <span className="front-kick">{s.kicker}</span>
                    <span className="front-story__title">{s.title}</span>
                    <span className="front-story__dek">{s.dek}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}

          <NotesCard games={notes} href={board?.href ?? '/desk/nfl'} />

          <NewsCard news={news} />

          {board && rows.length > 0 && (
            <section className="front-card">
              <header className="front-hd"><h2>Research Desk · {board.title}</h2><Link href={board.href}>Full board</Link></header>
              <div className="front-tbl" tabIndex={0} role="region" aria-label={`${board.title} board`}>
                <table>
                  <thead><tr><th scope="col">Game</th><th scope="col" className="is-num">Spread</th><th scope="col" className="is-num">Total</th><th scope="col" className="is-num">Opened</th><th scope="col" className="is-num">Research</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 8).map(r => (
                      <tr key={r.id}>
                        <td><Link href={r.href}><b>{r.matchup}</b></Link><LiveWhen gameId={r.id} fallback={r.when} /></td>
                        <td className="is-num">{r.spread ? <LiveLine gameId={r.id} kind="spread" fallback={r.spread} /> : '—'}</td>
                        <td className="is-num">{r.total ? <LiveLine gameId={r.id} kind="total" fallback={r.total} /> : '—'}</td>
                        <td className="is-num front-dim">{[r.spreadOpen, r.totalOpen].filter(Boolean).join(' / ') || '—'}</td>
                        <td className="is-num">{r.research > 0 ? r.research : <span className="front-dim">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        <aside className="front-right" aria-label="Membership and the record">
          <Cta cta={cta} locked={brief.lockedCount} isToday={brief.isToday} />

          {h && (
            <section className="front-card">
              <header className="front-hd"><h2>EdTheStatBot · {h.sport}</h2><Link href="/portfolio/performance">Results</Link></header>
              <div className="front-rec">
                <div className="front-rec__big">
                  <b>{h.record}</b>
                  <span className={h.unitsValue >= 0 ? 'front-up' : 'front-down'}>{minus(h.units)}</span>
                </div>
                <p className="front-rec__meta">
                  {proof.headlineInSeason ? 'This season' : 'Best sport'}{h.from ? `, since ${shortDate(h.from)}` : ''}. Every pick graded in public.
                </p>
                <UnitsChart series={series} last={h.unitsValue} />
                <div className="front-rec__split">
                  <div><small>Win rate</small><b>{h.pct.toFixed(1)}%</b></div>
                  <div><small>Graded</small><b>{h.graded}</b></div>
                  {proof.books.members && (
                    <div><small>{BOOK_LABEL.members}, all</small><b>{proof.books.members.record}</b></div>
                  )}
                </div>
              </div>
            </section>
          )}

          {signedOut && <HomeFreeBox />}

          <section className="front-card front-discord">
            <svg className="front-discord__icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            <div className="front-discord__text">
              <b>Join the Discord</b>
              <small>Picks pinged the second they drop.</small>
            </div>
            <a href="https://discord.gg/rXBZkSPcJb" className="front-btn front-discord__btn" target="_blank" rel="noopener">Join</a>
          </section>
        </aside>
      </div>
    </div>
    </LiveProvider>
  )
}
