import type { Metadata } from 'next'
import Link from 'next/link'
import { createCachedClient, DB_TAGS } from '@/lib/supabase/cached'
import { DEFAULT_MODEL_PICKS } from '@/lib/site-content'
import type { ModelPicksContent } from '@/lib/site-content'
import type { TodaysBet } from '@/components/TodaysBets'
import ModelPicksEditor from '@/components/ModelPicksEditor'
import NeverMissAPick from '@/components/NeverMissAPick'
import { getAccess } from '@/lib/access-server'
import { atLeastTier } from '@/lib/access'
import { rowMinTier } from '@/lib/gate'
import { buildProof, BOOK_LABEL } from '@/lib/proof'
import { oddsOf, unitsFor, DEFAULT_ODDS } from '@/lib/records'
import { buildCard, buildHistory, dayLabel, type PortfolioGame, type PortfolioSource } from '@/lib/portfolio'
import { trackPick, type TrackGame } from '@/lib/live/track'
import type { PickTrack } from '@/lib/live/types'
import { gamePath } from '@/lib/nfl'
import LiveProvider from '@/components/live/LiveProvider'
import PortfolioCard from '@/components/portfolio/PortfolioCard'
import '@/styles/portfolio-v2.css'

export const metadata: Metadata = {
  // Just the page name: app/layout.tsx appends ' – EdTheStatMan.com' through
  // its title template, so carrying the site name here rendered
  // "The Portfolio — EdTheStatMan.com – EdTheStatMan.com" in the tab.
  title: 'The Portfolio',
  description: 'Every active play the model is on, updated daily, with the full line and number on each one.',
  alternates: { canonical: 'https://edthestatman.com/portfolio' },
  openGraph: {
    title: 'The Portfolio — EdTheStatMan.com',
    description: 'Every active play the model is on, updated daily, with the full line and number on each one.',
    url: 'https://edthestatman.com/portfolio',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
}

export const dynamic = 'force-dynamic'

interface GameRow extends TrackGame {
  slug: string | null
  kickoff: string | null
  status: string | null
  home_score: number | null
  away_score: number | null
}

const RESULT_MARK = { win: 'W', loss: 'L', push: 'P' } as const
const ISO = /^\d{4}-\d{2}-\d{2}$/

function signed(u: number): string {
  return `${u > 0 ? '+' : u < 0 ? '−' : ''}${Math.abs(u).toFixed(2)}`
}

function minus(s: string): string {
  return s.replace(/-/g, '−')
}

export default async function Portfolio() {
  // Cached: shared by every visitor, gated per visitor below.
  const [betsResult, contentResult] = await Promise.all([
    (createCachedClient([DB_TAGS.picks]) as any).from('todays_bets').select('*').order('created_at', { ascending: false }),
    (createCachedClient([DB_TAGS.content]) as any).from('site_content').select('key, value').eq('key', 'model_picks'),
  ])

  const allBets: TodaysBet[] = betsResult.data ?? []

  const contentByKey: Record<string, unknown> = {}
  for (const row of (contentResult.data ?? []) as { key: string; value: unknown }[]) {
    contentByKey[row.key] = row.value
  }
  const headerContent: ModelPicksContent = {
    ...DEFAULT_MODEL_PICKS,
    ...(contentByKey.model_picks as object ?? {}),
  }

  const access = await getAccess()
  const { tier: userTier, isAdmin } = access

  // The picks ARE the Portfolio product, so they open at that rung. Rows are
  // classified through rowMinTier() so this works before and after the
  // min_tier migration -- see lib/gate.ts.
  const isMember = isAdmin || access.atLeast('portfolio')
  const canSee = (b: PortfolioSource) => isAdmin || atLeastTier(userTier, rowMinTier(b as any, 'portfolio'))

  const rows = allBets as unknown as PortfolioSource[]

  // The Desk games behind the open picks. Public facts only (teams, kickoff,
  // score), read for locked picks too: "Ed has a play on WSH @ NYG" is what the
  // Desk board already says through its per-game bet counts. Only open picks'
  // games are read, not every game a pick was ever linked to.
  const openGameIds = Array.from(new Set(
    rows
      .filter(r => r.game_id && r.is_active !== false && r.date && ISO.test(r.date))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, 60)
      .map(r => r.game_id as string)
  ))
  const games = new Map<string, PortfolioGame>()
  const trackGames = new Map<string, TrackGame>()
  if (openGameIds.length > 0) {
    const { data } = await (createCachedClient([DB_TAGS.games]) as any)
      .from('nfl_games')
      .select('id, sport, slug, kickoff, status, home_team, home_abbrev, away_team, away_abbrev, home_score, away_score')
      .in('id', openGameIds)
    for (const g of (data ?? []) as GameRow[]) {
      trackGames.set(g.id, g)
      games.set(g.id, {
        id: g.id,
        sport: g.sport,
        away: g.away_abbrev,
        home: g.home_abbrev,
        kickoff: g.kickoff,
        status: g.status,
        awayScore: g.away_score,
        homeScore: g.home_score,
        href: g.slug ? gamePath(g.sport, g.slug) : null,
      })
    }
  }

  // Gated here: visible picks copied field by field, locked ones reduced to
  // sport + game (lib/portfolio.ts).
  const days = buildCard(rows, canSee, games)

  // Live tracking, built here and only for visible picks, so a locked pick's
  // side and number never reach the browser (lib/live/track.ts).
  const tracks: PickTrack[] = []
  for (const day of days) {
    for (const p of day.picks) {
      if (p.kind !== 'visible' || !p.game) continue
      const g = trackGames.get(p.game.id)
      if (g) tracks.push(trackPick({ id: p.id, gameId: g.id, bet: p.bet, line: p.line }, g))
    }
  }

  const history = buildHistory(rows, canSee, r => unitsFor(String(r.result).toLowerCase(), oddsOf(r) ?? DEFAULT_ODDS))
  const proof = buildProof(rows as any)
  const books = (['members', 'free'] as const).map(k => ({ key: k, stat: proof.books[k] })).filter(b => b.stat)

  const total = days.reduce((n, d) => n + d.picks.length, 0)
  const locked = days.reduce((n, d) => n + d.picks.filter(p => p.kind === 'locked').length, 0)
  const sports = Array.from(new Set(days.flatMap(d => d.picks.map(p => p.sport))))
  const title = days.length === 0 ? 'No open plays' : days[0].isToday ? 'Today’s card' : `Card for ${dayLabel(days[0].date)}`

  return (
    <>
      <LiveProvider>
        <main className="pf">
          <div className="pf-wrap">
            <header className="pf-head">
              <div className="pf-head__title">
                <span className="pf-kick">The Portfolio</span>
                <h1>{title}</h1>
                <p>
                  {total > 0
                    ? <>{total} {total === 1 ? 'play' : 'plays'}{sports.length ? ` · ${sports.join(', ')}` : ''}{locked > 0 ? ` · ${locked} locked` : ''}. Scores and cover status update live while games are on.</>
                    : 'The card goes up the night before. Alerts go out by email, push and Discord when it does.'}
                </p>
              </div>
              {books.length > 0 && (
                <dl className="pf-rec">
                  {books.map(({ key, stat }) => (
                    <div key={key}>
                      <dt>{BOOK_LABEL[key]}</dt>
                      <dd><b>{stat!.record}</b> <span className={stat!.unitsValue >= 0 ? 'pf-up' : 'pf-down'}>{minus(stat!.units)}</span></dd>
                      <dd className="pf-rec__sub">{stat!.pct.toFixed(1)}% · {stat!.graded} graded</dd>
                    </div>
                  ))}
                  <div className="pf-rec__link"><Link href="/portfolio/performance">Full results</Link></div>
                </dl>
              )}
            </header>

            {days.length > 0 ? (
              <PortfolioCard days={days} tracks={tracks} />
            ) : (
              <section className="pf-panel pf-empty">
                <p>
                  {isMember
                    ? 'No open plays right now. They land here, and in your inbox, the moment Ed posts them.'
                    : 'No open plays right now. Every graded pick is below and on the results page.'}
                </p>
                {!isMember && <Link href="/win" className="pf-btn">See plans</Link>}
              </section>
            )}

            {!isMember && locked === 0 && total > 0 && (
              <section className="pf-panel pf-empty">
                <p>The members&rsquo; card carries the rest of Ed&rsquo;s plays, every one graded in public.</p>
                <Link href="/win" className="pf-btn">See plans</Link>
              </section>
            )}

            <div className="pf-lower">
              <section className="pf-panel">
                <header className="pf-panel__hd">
                  <h2>Recent results</h2>
                  <Link href="/portfolio/performance">All graded picks</Link>
                </header>
                {history.length === 0 ? (
                  <p className="pf-empty__line">
                    {isMember
                      ? 'No graded picks to show yet.'
                      : <>The plays you can see have no graded results yet. Every graded members&rsquo; pick is on the <Link href="/portfolio/performance">results page</Link>.</>}
                  </p>
                ) : (
                  <>
                    <ol className="pf-marks" aria-label="Most recent first">
                      {history.map(h => (
                        <li key={h.id} className={`pf-mark pf-mark--${h.result}`} title={`${h.sport} · ${h.bet}`}>{RESULT_MARK[h.result]}</li>
                      ))}
                    </ol>
                    <ul className="pf-hist">
                      {history.map(h => (
                        <li key={h.id}>
                          <span className="pf-hist__date">{h.date && ISO.test(h.date) ? dayLabel(h.date) : h.date ?? '—'}</span>
                          <span className="pf-tag">{h.sport}</span>
                          <span className="pf-hist__bet" title={h.bet}>{h.bet}{h.line ? <small> {minus(h.line)}</small> : null}</span>
                          <span className={`pf-badge pf-badge--${h.result}`}>{RESULT_MARK[h.result]}</span>
                          <span className={`pf-hist__u ${h.units > 0 ? 'pf-up' : h.units < 0 ? 'pf-down' : ''}`}>{signed(h.units)}u</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>

              <section className="pf-panel">
                <header className="pf-panel__hd"><h2>How the card works</h2></header>
                <ul className="pf-how">
                  <li><b>Posted the night before.</b> Alerts go out by email, push and Discord the moment a play lands.</li>
                  <li><b>Tracked live.</b> Each play shows its game&rsquo;s score and whether it is covering while the game is on.</li>
                  <li><b>Graded in public.</b> A final reads &ldquo;unofficial&rdquo; until Ed grades it; then it goes on the <Link href="/portfolio/performance">results page</Link>, win or lose.</li>
                  <li><b>Backed by the Vault.</b> The plays come out of the <Link href="/vault/systems">systems</Link> and <Link href="/vault/trends">trends</Link> on the Research Desk.</li>
                </ul>
              </section>
            </div>
          </div>
        </main>
      </LiveProvider>

      {/* Admins keep the editor exactly as before (rows, header text, notify),
          under the public view so the card can be checked as visitors see it. */}
      {isAdmin && (
        <section className="pf-admin" aria-label="Edit the card">
          <ModelPicksEditor rows={allBets.filter(canSee as any)} userTier={userTier} headerContent={headerContent} />
        </section>
      )}
      <NeverMissAPick userTier={userTier} />
    </>
  )
}
