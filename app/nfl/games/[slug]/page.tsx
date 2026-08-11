import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAccess, ACCESS_SELECT } from '@/lib/access'
import { toPublicGame, weekLabel, writeupWordCount } from '@/lib/nfl'
import type { NflGame } from '@/lib/nfl'
import { toTeaser } from '@/lib/teaser'
import type { LockedTeaser } from '@/lib/teaser'
import NflGameAdminPanel from '@/components/NflGameAdminPanel'
import LockedTeaserCard from '@/components/LockedTeaserCard'
import RecordStrip from '@/components/RecordStrip'
import { IconLock } from '@/components/Icons'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const admin = createAdminClient()
  const { data: game } = await (admin as any)
    .from('nfl_games')
    .select('away_team, home_team, season_type, week, brief, kickoff, is_published')
    .eq('slug', params.slug)
    .single()

  if (!game || !game.is_published) return { title: 'Game Not Found' }

  const title = `${game.away_team} at ${game.home_team} — ${weekLabel(game.season_type, game.week)} Prediction, Odds & Betting Analysis`
  const description = game.brief
    || `${game.away_team} at ${game.home_team}: betting systems, trends, and Elite analysis for ${weekLabel(game.season_type, game.week)}.`
  const url = `https://edthestatman.com/nfl/games/${params.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'EdTheStatMan',
      images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-cover.jpg'] },
  }
}

const STATUS_LABEL: Record<string, string> = { pre: 'Upcoming', in: 'Live', post: 'Final' }

function kickoffDisplay(kickoff: string | null): string {
  if (!kickoff) return 'Kickoff TBD'
  return new Date(kickoff).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
  })
}

export default async function NflGamePage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let access = resolveAccess(null, false)
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select(ACCESS_SELECT)
      .eq('id', user.id)
      .single()
    access = resolveAccess(profile as any, true)
  }
  const { isAdmin, isPaid, hasElite } = access

  const { data: gameRow } = await (admin as any)
    .from('nfl_games')
    .select('*')
    .eq('slug', params.slug)
    .single()

  const game: NflGame | null = gameRow ?? null
  if (!game || (!game.is_published && !isAdmin)) notFound()

  const publicGame = toPublicGame(game)

  // Curated systems/trends for this game.
  const [sysLinks, trendLinks] = await Promise.all([
    (admin as any).from('nfl_game_systems').select('system_id').eq('game_id', game.id),
    (admin as any).from('nfl_game_trends').select('trend_id').eq('game_id', game.id),
  ])
  const systemIds = (sysLinks.data ?? []).map((r: any) => r.system_id)
  const trendIds = (trendLinks.data ?? []).map((r: any) => r.trend_id)

  const [systemsResult, trendsResult] = await Promise.all([
    systemIds.length
      ? (admin as any).from('betting_systems').select('*').in('id', systemIds).eq('is_active', true)
      : Promise.resolve({ data: [] }),
    trendIds.length
      ? (admin as any).from('betting_trends').select('*').in('id', trendIds).eq('is_active', true)
      : Promise.resolve({ data: [] }),
  ])

  // Linked rows follow the same tier rules as the systems/trends pages: paid
  // members see member rows, elite rows require elite, and everyone else gets
  // record-only teasers. Redaction happens here, before props cross the wire.
  function partition(rows: any[]): { visible: any[]; locked: LockedTeaser[]; lockedElite: LockedTeaser[] } {
    const visible: any[] = []
    const locked: LockedTeaser[] = []
    const lockedElite: LockedTeaser[] = []
    for (const row of rows) {
      const canSee = row.is_elite ? hasElite : (isPaid || isAdmin || row.is_free)
      if (canSee) visible.push(row)
      else if (row.is_elite) lockedElite.push(toTeaser(row))
      else locked.push(toTeaser(row))
    }
    return { visible, locked, lockedElite }
  }
  const systems = partition(systemsResult.data ?? [])
  const trends = partition(trendsResult.data ?? [])

  // Admin-only: full NFL system/trend lists for the linking UI.
  let adminPanel: JSX.Element | null = null
  if (isAdmin) {
    const [allSystems, allTrends] = await Promise.all([
      (admin as any).from('betting_systems').select('id, description, sport, w, l, t').in('sport', ['nfl', 'nflpre']).order('date', { ascending: false, nullsFirst: false }),
      (admin as any).from('betting_trends').select('id, description, sport, w, l, t').in('sport', ['nfl', 'nflpre']).order('created_at', { ascending: false }),
    ])
    adminPanel = (
      <NflGameAdminPanel
        game={{
          id: game.id,
          brief: game.brief,
          writeup_html: game.writeup_html,
          is_published: game.is_published,
        }}
        allSystems={allSystems.data ?? []}
        allTrends={allTrends.data ?? []}
        linkedSystemIds={systemIds}
        linkedTrendIds={trendIds}
      />
    )
  }

  const showScore = game.status !== 'pre' && game.home_score !== null && game.away_score !== null
  const words = writeupWordCount(game.writeup_html)
  const url = `https://edthestatman.com/nfl/games/${game.slug}`

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SportsEvent',
            name: `${game.away_team} at ${game.home_team}`,
            startDate: game.kickoff ?? undefined,
            eventStatus: game.status === 'post' ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventScheduled',
            homeTeam: { '@type': 'SportsTeam', name: game.home_team },
            awayTeam: { '@type': 'SportsTeam', name: game.away_team },
            sport: 'American Football',
            url,
          }),
        }}
      />

      <section className="section" style={{ paddingBottom: '48px' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <Link href="/nfl" className="blog-post__back">← Back to NFL Hub</Link>

          <header className="nfl-game-header reveal">
            <div className="nfl-game-header__meta">
              <span className="section-label" style={{ margin: 0 }}>
                {game.season} · {weekLabel(game.season_type, game.week)}
              </span>
              <span className={`nfl-game-card__status nfl-game-card__status--${game.status}`}>
                {STATUS_LABEL[game.status] ?? game.status}
              </span>
              {isAdmin && !game.is_published && <span className="nfl-game-card__draft">Draft</span>}
            </div>
            <h1 className="nfl-game-header__title">
              {game.away_team} <span className="nfl-game-header__at">at</span> {game.home_team}
            </h1>
            <p className="nfl-game-header__kickoff">{kickoffDisplay(game.kickoff)}</p>
            {showScore && (
              <div className="nfl-game-header__score">
                <span>{game.away_abbrev} {game.away_score}</span>
                <span className="nfl-game-header__score-sep">—</span>
                <span>{game.home_abbrev} {game.home_score}</span>
              </div>
            )}
            {game.brief && <p className="nfl-game-header__brief">{game.brief}</p>}
          </header>

          {adminPanel}

          {/* The breakdown — elite-only IP. Non-elite readers get word count
              and a CTA; the HTML itself never leaves the server for them. */}
          {hasElite && words > 0 && (
            <article
              className="blog-post__content nfl-game-writeup"
              dangerouslySetInnerHTML={{ __html: game.writeup_html }}
            />
          )}
          {!hasElite && publicGame.has_writeup && (
            <div className="sys-gate-card sys-gate-card--elite reveal" style={{ maxWidth: 'none' }}>
              <div className="sys-gate-card__icon"><IconLock size={30} /></div>
              <div className="content-gate-card__title">
                The full {game.away_abbrev}–{game.home_abbrev} breakdown is inside
              </div>
              <p className="content-gate-card__desc">
                {publicGame.writeup_words} words of matchup analysis, angles, and the systems behind them — Elite members only.
              </p>
              <div className="content-gate-card__actions">
                <Link href="/win" className="btn btn--primary">Go Elite &rarr;</Link>
              </div>
            </div>
          )}

          {/* Linked systems & trends */}
          {(systems.visible.length + systems.locked.length + systems.lockedElite.length > 0) && (
            <LinkedSection
              title="Systems on this game"
              visible={systems.visible}
              locked={systems.locked}
              lockedElite={systems.lockedElite}
              href="/betting-systems"
            />
          )}
          {(trends.visible.length + trends.locked.length + trends.lockedElite.length > 0) && (
            <LinkedSection
              title="Trends on this game"
              visible={trends.visible}
              locked={trends.locked}
              lockedElite={trends.lockedElite}
              href="/betting-trends"
            />
          )}
        </div>
      </section>
    </main>
  )
}

function LinkedSection({ title, visible, locked, lockedElite, href }: {
  title: string
  visible: any[]
  locked: LockedTeaser[]
  lockedElite: LockedTeaser[]
  href: string
}) {
  return (
    <div className="nfl-linked-section reveal">
      <h2 className="nfl-linked-section__title">{title}</h2>
      <div className="sys-card-grid">
        {visible.map(row => (
          <div key={row.id} className={`sys-row-card sys-row-card--${row.sport}`}>
            <div className="sys-row-card__body">
              <div className="sys-row-card__sport-col">
                <span className="sys-row-card__sport-badge">{row.sport === 'nflpre' ? 'NFL Pre' : 'NFL'}</span>
              </div>
              <div className="sys-row-card__desc-col">
                <div className="sys-row-card__desc">{row.description}</div>
                {row.is_elite && (
                  <span className="sys-row-card__access-badge sys-row-card__access-badge--elite">Elite</span>
                )}
              </div>
              <div className="sys-row-card__field">
                <span className="sys-row-card__field-label">Record</span>
                <span className={`sys-row-card__record sys-row-card__record--${row.w > row.l ? 'win' : row.w < row.l ? 'loss' : 'neutral'}`}>
                  {row.w}-{row.l}-{row.t}
                </span>
              </div>
              <div className="sys-row-card__pct-col">
                <span className={`sys-row-card__pct sys-row-card__pct--${row.w > row.l ? 'win' : 'neutral'}`}>
                  {row.pct === null || row.pct === undefined ? '—' : `${Math.round(row.pct * 100)}%`}
                </span>
                <RecordStrip w={row.w} l={row.l} t={row.t} />
              </div>
            </div>
          </div>
        ))}
        {lockedElite.map(t => (
          <LockedTeaserCard key={t.id} teaser={t} sportLabel="NFL" sportClass={t.sport} variant="elite" />
        ))}
        {locked.map(t => (
          <LockedTeaserCard key={t.id} teaser={t} sportLabel="NFL" sportClass={t.sport} />
        ))}
      </div>
      <p style={{ marginTop: '12px' }}>
        <Link href={href} style={{ color: 'var(--accent-teal)', fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none' }}>
          View all →
        </Link>
      </p>
    </div>
  )
}
