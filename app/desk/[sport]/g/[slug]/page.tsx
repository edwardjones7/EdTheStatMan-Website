import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAccess, ACCESS_SELECT, atLeastTier } from '@/lib/access'
import { rowMinTier } from '@/lib/gate'
import { toPublicGame, weekLabel, writeupWordCount } from '@/lib/nfl'
import type { NflGame } from '@/lib/nfl'
import { toTeaser } from '@/lib/teaser'
import type { LockedTeaser } from '@/lib/teaser'
import NflGameAdminPanel from '@/components/NflGameAdminPanel'
import LockedTeaserCard from '@/components/LockedTeaserCard'
import RecordStrip from '@/components/RecordStrip'
import { IconLock } from '@/components/Icons'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { sport: string; slug: string } }): Promise<Metadata> {
  const admin = createAdminClient()
  const { data: game } = await (admin as any)
    .from('nfl_games')
    .select('away_team, home_team, season_type, week, brief, kickoff, is_published')
    .eq('sport', params.sport.toLowerCase())
    .eq('slug', params.slug)
    .maybeSingle()

  if (!game || !game.is_published) return { title: 'Game Not Found' }

  const title = `${game.away_team} at ${game.home_team} — ${weekLabel(game.season_type, game.week, params.sport)} Prediction, Odds & Betting Analysis`
  const description = game.brief
    || `${game.away_team} at ${game.home_team}: betting systems, trends, and Elite analysis for ${weekLabel(game.season_type, game.week, params.sport)}.`
  const url = `https://edthestatman.com/desk/${params.sport}/g/${params.slug}`
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

export default async function NflGamePage({ params }: { params: { sport: string; slug: string } }) {
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
  const { tier: userTier, isAdmin, hasElite } = access
  // The Desk's defining rule: curated Vault rows are visible IN THE CONTEXT
  // of a matchup to Desk members, even though the browsable library is
  // Private. Institutional rows stay institutional everywhere.
  const hasDesk = isAdmin || access.atLeast('desk')

  const { data: gameRow } = await (admin as any)
    .from('nfl_games')
    .select('*')
    // Scoped by sport as well as slug: the slug is unique table-wide, but a
    // game should only ever answer under its own league's path.
    .eq('sport', params.sport.toLowerCase())
    .eq('slug', params.slug)
    .maybeSingle()

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
      const required = rowMinTier(row, 'private')
      const canSee =
        isAdmin ||
        atLeastTier(userTier, required) ||
        (hasDesk && required !== 'institutional')
      if (canSee) visible.push(row)
      else if (required === 'institutional') lockedElite.push(toTeaser(row))
      else locked.push(toTeaser(row))
    }
    return { visible, locked, lockedElite }
  }
  const systems = partition(systemsResult.data ?? [])
  const trends = partition(trendsResult.data ?? [])

  // Admin-only: full NFL system/trend lists for the linking UI.
  let adminPanel: JSX.Element | null = null
  if (isAdmin) {
    // Offer the sport THIS game is in. The list was pinned to nfl/nflpre, so a
    // college game page handed the admin NFL systems to link against it -- wrong
    // rows entirely, and /desk/cfb is live. Preseason and regular NFL share a
    // library, so they stay paired.
    const sportKey = params.sport.toLowerCase()
    const linkSports = sportKey === 'nfl' || sportKey === 'nflpre'
      ? ['nfl', 'nflpre']
      : [sportKey]

    const [allSystems, allTrends] = await Promise.all([
      (admin as any).from('betting_systems').select('id, description, sport, team, w, l, t').in('sport', linkSports),
      (admin as any).from('betting_trends').select('id, description, sport, team, w, l, t').in('sport', linkSports),
    ])

    // Ordered for the person doing the linking, not by insert date.
    //
    // The number is inside the description ("NFL System #5 - ...", "Bills Trend
    // #1 - ..."), not a column, so it is parsed rather than sorted in SQL. Every
    // NFL row carries one (42 systems, 86 trends, none missing), but other
    // sports may not, so anything unnumbered sorts last by description instead
    // of silently landing at #0.
    const linkNo = (d: string | null | undefined) => {
      const m = /#s*(d+)/.exec(d ?? '')
      return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
    }
    // Sport before number, because nfl and nflpre share this picker: without it
    // "NFL Preseason System #1" and "NFL System #1" tie on the number and the two
    // libraries interleave all the way down. Alphabetical puts nfl before nflpre.
    const byNumber = (a: any, b: any) =>
      (a.sport ?? '').localeCompare(b.sport ?? '') ||
      linkNo(a.description) - linkNo(b.description) ||
      (a.description ?? '').localeCompare(b.description ?? '')
    // Team first, then number within the team. Teamless rows go last rather
    // than sorting to the top on an empty string.
    const byTeamThenNumber = (a: any, b: any) => {
      const ta = (a.team ?? '').trim(), tb = (b.team ?? '').trim()
      if (!ta !== !tb) return ta ? -1 : 1
      return ta.localeCompare(tb) || byNumber(a, b)
    }

    const sortedSystems = [...(allSystems.data ?? [])].sort(byNumber)
    const sortedTrends = [...(allTrends.data ?? [])].sort(byTeamThenNumber)
    adminPanel = (
      <NflGameAdminPanel
        game={{
          id: game.id,
          brief: game.brief,
          writeup_html: game.writeup_html,
          is_published: game.is_published,
        }}
        allSystems={sortedSystems}
        allTrends={sortedTrends}
        linkedSystemIds={systemIds}
        linkedTrendIds={trendIds}
      />
    )
  }

  const showScore = game.status !== 'pre' && game.home_score !== null && game.away_score !== null
  const words = writeupWordCount(game.writeup_html)
  const url = `https://edthestatman.com/desk/${params.sport}/g/${game.slug}`

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
          <Link href={`/desk/${params.sport}`} className="blog-post__back">← Back to the Desk</Link>

          <header className="nfl-game-header reveal">
            <div className="nfl-game-header__meta">
              <span className="section-label" style={{ margin: 0 }}>
                {game.season} · {weekLabel(game.season_type, game.week, params.sport)}
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
              href="/vault/systems"
            />
          )}
          {(trends.visible.length + trends.locked.length + trends.lockedElite.length > 0) && (
            <LinkedSection
              title="Trends on this game"
              visible={trends.visible}
              locked={trends.locked}
              lockedElite={trends.lockedElite}
              href="/vault/trends"
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
