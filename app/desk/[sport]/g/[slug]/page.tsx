import LiveProvider from '@/components/live/LiveProvider'
import LiveGameScore from '@/components/live/LiveGameScore'
import GameIntel from '@/components/GameIntel'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createCachedClient, DB_TAGS } from '@/lib/supabase/cached'
import { resolveAccess, ACCESS_SELECT, atLeastTier } from '@/lib/access'
import { rowMinTier, researchClosedFor, holdsLibrary } from '@/lib/gate'
import { toPublicPick } from '@/lib/picks/public'
import { oddsOf } from '@/lib/records'
import {
  toPublicGame, weekLabel, writeupWordCount,
  gameBrief, gameBriefSentences, spreadLabel, moneylineLabel, lineMove,
  decodeSlugParam, gamePath, weekIsOver,
} from '@/lib/nfl'
import type { NflGame } from '@/lib/nfl'
import { deskSportLabel, deskSeasonLabel, SPORT_SHORT, startWord, weeksFromDates, easternDate, addDays } from '@/lib/desk'
import { atsTag, ouTag } from '@/lib/ats'
import { teamPath, teamSeasonGames, teamShortName, byKickoff } from '@/lib/desk-teams'
import '@/styles/seo-desk.css'
import { toTeaser } from '@/lib/teaser'
import type { LockedTeaser } from '@/lib/teaser'
import NflGameAdminPanel from '@/components/NflGameAdminPanel'
import LockedTeaserCard from '@/components/LockedTeaserCard'
import SignupPrompt from '@/components/SignupPrompt'
import RecordStrip from '@/components/RecordStrip'
import { IconLock } from '@/components/Icons'
import CopyLineButton from '@/components/CopyLineButton'
import FollowStar from '@/components/FollowStar'
import { teamLogoUrl } from '@/lib/logos'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { sport: string; slug: string } }): Promise<Metadata> {
  const admin = createCachedClient([DB_TAGS.games, DB_TAGS.picks, DB_TAGS.vault])
  // Page params arrive percent-encoded; the stored slug is not. See decodeSlugParam.
  const slug = decodeSlugParam(params.slug)
  const { data: game } = await (admin as any)
    .from('nfl_games')
    .select('*')
    .eq('sport', params.sport.toLowerCase())
    .eq('slug', slug)
    .maybeSingle()

  if (!game || !game.is_published) return { title: 'Game Not Found' }

  const title = `${game.away_team} at ${game.home_team} — ${gameWhen(game, params.sport)} Prediction, Odds & Betting Analysis`
  // The generated brief is the fallback description: two sentences of it say
  // more about the matchup than the old boilerplate did, and it is never empty.
  const description = game.brief || gameBriefSentences(game).slice(0, 2).join(' ')
  const url = `https://edthestatman.com${gamePath(params.sport, slug)}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'EdTheStatMan',
      // The image is the matchup card in ./opengraph-image.tsx (and
      // ./twitter-image.tsx), which Next attaches to this route.
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

const STATUS_LABEL: Record<string, string> = { pre: 'Upcoming', in: 'Live', post: 'Final' }

/**
 * Which game this is, for the title. A football week names it; a basketball
 * "week" is our own bookkeeping, and the same teams can meet twice in one, so
 * the date does the naming there.
 */
function gameWhen(game: Pick<NflGame, 'season_type' | 'week' | 'season' | 'kickoff'>, sport: string): string {
  if (weeksFromDates(sport) && game.kickoff) {
    return new Date(game.kickoff).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
    })
  }
  return weekLabel(game.season_type, game.week, sport, game.season)
}

function kickoffDisplay(kickoff: string | null, sport: string, tbd?: boolean | null): string {
  if (!kickoff) return weeksFromDates(sport) ? 'Tip-off TBD' : 'Kickoff TBD'
  if (tbd) {
    const day = new Date(kickoff).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
    })
    return `${day} · ${weeksFromDates(sport) ? 'Tip-off' : 'Kickoff'} time TBD`
  }
  return new Date(kickoff).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
  })
}

export default async function NflGamePage({ params }: { params: { sport: string; slug: string } }) {
  const admin = createCachedClient([DB_TAGS.games, DB_TAGS.picks, DB_TAGS.vault])
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
  // of a matchup to Desk members. (The Desk now holds the whole Vault as well,
  // so this mostly matters for a closed week, where the in-context window
  // shuts but the library itself does not.)
  const hasDesk = isAdmin || access.atLeast('desk')

  const { data: gameRow } = await (admin as any)
    .from('nfl_games')
    .select('*')
    // Scoped by sport as well as slug: the slug is unique table-wide, but a
    // game should only ever answer under its own league's path.
    .eq('sport', params.sport.toLowerCase())
    // Decoded, or every slug carrying an `&` misses and 404s a live game.
    .eq('slug', decodeSlugParam(params.slug))
    .maybeSingle()

  const game: NflGame | null = gameRow ?? null
  if (!game || (!game.is_published && !isAdmin)) notFound()

  const publicGame = toPublicGame(game)

  // Curated systems/trends for this game, and the week it belongs to.
  //
  // The week ride-along is two columns over one week of rows -- ~100 for a
  // college Saturday, 16 for an NFL Sunday -- and it answers the only question
  // this page cannot answer from the game alone: whether the week is over. It
  // goes out with the link queries rather than after them, so it costs no extra
  // round trip on the render path.
  // The internal links ride the same round trip: both teams' seasons (for
  // prev/next) and the rest of this game's Eastern calendar day. The day window
  // is padded past both UTC offsets Eastern time can have and then trimmed to
  // the exact date, so DST never drops a late tip or adds tomorrow's first one.
  const sportKey = params.sport.toLowerCase()
  const gameDay = game.kickoff ? easternDate(game.kickoff) : null
  const [sysLinks, trendLinks, weekRows, homeSeason, awaySeason, dayRows, betRows] = await Promise.all([
    (admin as any).from('nfl_game_systems').select('system_id').eq('game_id', game.id),
    (admin as any).from('nfl_game_trends').select('trend_id').eq('game_id', game.id),
    (admin as any)
      .from('nfl_games')
      .select('kickoff, status')
      .eq('sport', sportKey)
      .eq('season', game.season)
      .eq('season_type', game.season_type)
      .eq('week', game.week),
    teamSeasonGames(admin, sportKey, game.season, game.home_abbrev),
    teamSeasonGames(admin, sportKey, game.season, game.away_abbrev),
    gameDay
      ? (admin as any)
          .from('nfl_games')
          .select('id, slug, kickoff, status, home_abbrev, away_abbrev, home_score, away_score, spread_current, total_current')
          .eq('sport', sportKey)
          .eq('season', game.season)
          .eq('is_published', true)
          .gte('kickoff', `${gameDay}T03:00:00Z`)
          .lt('kickoff', `${addDays(gameDay, 1)}T06:00:00Z`)
          .order('kickoff', { ascending: true })
      : Promise.resolve({ data: [] }),
    // The bets on this game. Errors harmlessly (no rows) until
    // pricing_01_trial_and_pick_games.sql adds todays_bets.game_id.
    (admin as any).from('todays_bets').select('*').eq('game_id', game.id).order('id'),
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

  // Has the research on this game been shut?
  //
  // Automatic once the week is over, plus the manual per-game override. See
  // researchClosedFor() in lib/gate.ts for the rule and why it is week-shaped.
  //
  // A viewer who holds the library outright is never closed out, so this is
  // false for admins and for Private and above no matter how old the game is.
  //
  // Read `research_closed_at` defensively: the column arrives with
  // desk_01_research_closed.sql, and until that is applied it is simply
  // undefined and only the week rule applies.
  const weekOver = weekIsOver((weekRows as any).data ?? [], new Date())
  const viewerHoldsLibrary = holdsLibrary(userTier, isAdmin)
  const researchClosed = researchClosedFor(
    { weekOver, closedAt: (game as any).research_closed_at },
    viewerHoldsLibrary
  )

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
        // Private and Institutional members hold the library itself, so closing
        // a game takes nothing from them -- this clause is untouched by it.
        atLeastTier(userTier, required) ||
        // The Desk's in-context window, and the only thing closing shuts.
        (hasDesk && !researchClosed)
      if (canSee) visible.push(row)
      else locked.push(toTeaser(row))
    }
    return { visible, locked, lockedElite }
  }
  // The bets: free picks open to everyone, Portfolio picks open to whoever
  // holds the picks (the Portfolio or the Desk). Redacted here, on the server,
  // so a locked bet's line never crosses the wire.
  const bets: GameBet[] = ((betRows as any)?.data ?? [])
    .filter((row: any) => row.is_active !== false || row.show_on_results === true)
    .map((row: any) => {
      const pub = toPublicPick(row)
      const canSee = isAdmin || pub.free || atLeastTier(userTier, rowMinTier(row, 'portfolio'))
      return {
        key: pub.key,
        free: pub.free,
        locked: canSee ? false : pub.locked,
        bet: canSee ? row.bet ?? null : pub.bet,
        odds: canSee ? pub.odds ?? oddsOf({ odds: row.odds ?? null, line: row.line ?? null }) : pub.odds,
        result: pub.result,
        note: canSee ? row.note ?? null : pub.note,
      }
    })

  const systems = partition(systemsResult.data ?? [])
  const trends = partition(trendsResult.data ?? [])

  // Admin-only: the sport's full system/trend lists for the linking UI.
  let adminPanel: JSX.Element | null = null
  if (isAdmin) {
    // ONE SPORT PER PICKER. A game can only ever be linked to rows from its own
    // league, so the picker offers exactly that sport and nothing else. nfl and
    // nflpre used to be paired here because they share a library, but the Desk
    // has no preseason games (nfl_games carries season_type 2 and 3 only), so
    // pairing them only buried the 24 NFL systems under 18 preseason ones.
    const sportKey = params.sport.toLowerCase()
    const linkSports = [sportKey]

    // `code` is the Vault key (NFLS0006, CFBT0010) — the handle the admin
    // searches by, so it has to cross the wire.
    //
    // NOTE: betting_systems has NO `team` column (only betting_trends does).
    // Selecting it made PostgREST fail the whole query, `.data` came back null,
    // and the systems picker silently rendered empty for every sport. The
    // column list below is verified against the live schema.
    const [allSystems, allTrends] = await Promise.all([
      (admin as any).from('betting_systems').select('id, code, description, sport, w, l, t').in('sport', linkSports),
      (admin as any).from('betting_trends').select('id, code, description, sport, team, w, l, t').in('sport', linkSports),
    ])

    // Ordered for the person doing the linking, not by insert date.
    //
    // The Vault code is the primary key to the eye as well as to the search box,
    // so it drives the order: prefix first, then the number INSIDE it compared
    // numerically. Text order would be wrong -- college codes are padded to five
    // digits and one legacy row to four, so CFBS0025 would land after CFBS00061.
    const codeParts = (code: string | null | undefined): [string, number] => {
      const m = /^([A-Za-z]*)(\d*)/.exec((code ?? '').trim())
      return [(m?.[1] ?? '').toUpperCase(), m?.[2] ? parseInt(m[2], 10) : Number.MAX_SAFE_INTEGER]
    }
    // Fallback for a row imported without a code: the number inside the
    // description ("NFL System #5 - ..."), which every NFL row carries and
    // almost no college row does. Unnumbered rows sort last, by description,
    // instead of silently landing at #0.
    const linkNo = (d: string | null | undefined) => {
      const m = /#\s*(\d+)/.exec(d ?? '')
      return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER
    }
    const byCode = (a: any, b: any) => {
      const ca = (a.code ?? '').trim(), cb = (b.code ?? '').trim()
      // A codeless row goes last rather than riding an empty string to the top.
      if (!ca !== !cb) return ca ? -1 : 1
      const [pa, na] = codeParts(ca), [pb, nb] = codeParts(cb)
      return pa.localeCompare(pb) || na - nb ||
        linkNo(a.description) - linkNo(b.description) ||
        (a.description ?? '').localeCompare(b.description ?? '')
    }
    // Trends group by team first, then by code within the team. Teamless rows
    // go last, same reasoning.
    const byTeamThenCode = (a: any, b: any) => {
      const ta = (a.team ?? '').trim(), tb = (b.team ?? '').trim()
      if (!ta !== !tb) return ta ? -1 : 1
      return ta.localeCompare(tb) || byCode(a, b)
    }

    const sortedSystems = [...(allSystems.data ?? [])].sort(byCode)
    const sortedTrends = [...(allTrends.data ?? [])].sort(byTeamThenCode)
    adminPanel = (
      <NflGameAdminPanel
        game={{
          id: game.id,
          brief: game.brief,
          writeup_html: game.writeup_html,
          is_published: game.is_published,
          research_closed_at: (game as any).research_closed_at ?? null,
        }}
        sportLabel={deskSportLabel(sportKey)}
        allSystems={sortedSystems}
        allTrends={sortedTrends}
        linkedSystemIds={systemIds}
        linkedTrendIds={trendIds}
      />
    )
  }

  const showScore = game.status !== 'pre' && game.home_score !== null && game.away_score !== null
  const words = writeupWordCount(game.writeup_html)

  // The page used to be a headline, a kickoff time and whitespace until someone
  // wrote it up. These three give every game something to read: the brief, the
  // posted market, and an honest empty state where the research will go.
  const brief = gameBrief(publicGame)
  const spreadText = spreadLabel(publicGame.spread_current ?? publicGame.spread_open, game.home_abbrev, game.away_abbrev)
  const spreadMove = lineMove(publicGame.spread_open, publicGame.spread_current)
  const totalNow = publicGame.total_current ?? publicGame.total_open ?? null
  const totalMove = lineMove(publicGame.total_open, publicGame.total_current)
  const awayMl = moneylineLabel(publicGame.ml_away_current ?? publicGame.ml_away_open)
  const homeMl = moneylineLabel(publicGame.ml_home_current ?? publicGame.ml_home_open)
  const hasMarket = Boolean(spreadText || totalNow !== null || awayMl || homeMl)
  // "WSH @ NYG · NYG −1.5 · O/U 40.5" for the Copy line button.
  const copyText = [
    `${game.away_abbrev} @ ${game.home_abbrev}`,
    spreadText ? spreadText.replace(/-/g, '−') : null,
    totalNow !== null ? `O/U ${totalNow}` : null,
  ].filter(Boolean).join(' · ')
  const linkedCount =
    systems.visible.length + systems.locked.length + systems.lockedElite.length +
    trends.visible.length + trends.locked.length + trends.lockedElite.length
  const hasResearch = publicGame.has_writeup || linkedCount > 0 || bets.length > 0
  const url = `https://edthestatman.com${gamePath(params.sport, game.slug)}`

  // Graded against the closing line; null until the game is final and priced.
  const ats = atsTag(publicGame)
  const ou = ouTag(publicGame)

  // Prev/next for each side, from that team's own published season. A draft
  // game (admin view) is not in the list, so it simply gets no neighbours.
  const neighbours = (rows: NflGame[]) => {
    const i = rows.findIndex(r => r.id === game.id)
    return i < 0 ? { prev: null, next: null } : { prev: rows[i - 1] ?? null, next: rows[i + 1] ?? null }
  }
  const teamNav = [
    { abbrev: game.away_abbrev, name: teamShortName(sportKey, game.away_abbrev, game.away_team), ...neighbours(awaySeason) },
    { abbrev: game.home_abbrev, name: teamShortName(sportKey, game.home_abbrev, game.home_team), ...neighbours(homeSeason) },
  ]

  // Other games that day. A college Saturday is 60-plus games and a basketball
  // night can be 150, so the list is capped and leads with priced games -- the
  // ones with something on the page -- and the board link carries the rest.
  type DayRow = Pick<NflGame, 'id' | 'slug' | 'kickoff' | 'status' | 'home_abbrev' | 'away_abbrev' | 'home_score' | 'away_score' | 'spread_current' | 'total_current'>
  const sameDay: DayRow[] = (((dayRows as any).data ?? []) as DayRow[])
    .filter(r => r.id !== game.id && r.kickoff && easternDate(r.kickoff) === gameDay)
  const DAY_LINKS = 12
  const priced = (r: DayRow) => r.spread_current != null || r.total_current != null
  const dayLinks = [...sameDay]
    .sort((a, b) => Number(priced(b)) - Number(priced(a)) || byKickoff(a, b))
    .slice(0, DAY_LINKS)
    .sort(byKickoff)
  const dayBoardHref = weeksFromDates(sportKey) && gameDay
    ? `/desk/${sportKey}?day=${gameDay}`
    : `/desk/${sportKey}?week=${game.week}${game.season_type === 3 ? '&type=post' : ''}`
  const dayName = game.kickoff
    ? new Date(game.kickoff).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'America/New_York' })
    : null

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
            // schema.org has no "completed" status: a game that went ahead as
            // planned stays EventScheduled after it is played.
            eventStatus: 'https://schema.org/EventScheduled',
            ...(game.venue_name
              ? {
                  location: {
                    '@type': 'Place',
                    name: game.venue_name,
                    address: {
                      '@type': 'PostalAddress',
                      addressLocality: game.venue_city ?? undefined,
                      addressRegion: game.venue_state ?? undefined,
                    },
                  },
                }
              : {}),
            homeTeam: { '@type': 'SportsTeam', name: game.home_team },
            awayTeam: { '@type': 'SportsTeam', name: game.away_team },
            sport: weeksFromDates(params.sport) ? 'Basketball' : 'American Football',
            url,
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Research Desk', item: 'https://edthestatman.com/desk' },
              { '@type': 'ListItem', position: 2, name: deskSportLabel(sportKey), item: `https://edthestatman.com/desk/${sportKey}` },
              { '@type': 'ListItem', position: 3, name: `${game.away_team} at ${game.home_team}`, item: url },
            ],
          }),
        }}
      />

      <section className="section" style={{ paddingBottom: '48px' }}>
        <div className="container" style={{ maxWidth: '900px' }}>
          <Link href={`/desk/${params.sport}`} className="blog-post__back">← Back to the Desk</Link>

          <header className="nfl-game-header reveal">
            <div className="nfl-game-header__meta">
              <span className="section-label" style={{ margin: 0 }}>
                {deskSeasonLabel(params.sport, game.season)} · {weekLabel(game.season_type, game.week, params.sport, game.season)}
              </span>
              <span className={`nfl-game-card__status nfl-game-card__status--${game.status}`}>
                {STATUS_LABEL[game.status] ?? game.status}
              </span>
              {isAdmin && !game.is_published && <span className="nfl-game-card__draft">Draft</span>}
            </div>
            <h1 className="nfl-game-header__title">
              {game.away_team} <span className="nfl-game-header__at">at</span> {game.home_team}
            </h1>
            <p className="nfl-game-header__kickoff">{kickoffDisplay(game.kickoff, params.sport, game.kickoff_tbd)}</p>
            {/* Live from /api/live while it is played; the stored score otherwise.
                Upcoming games render nothing until the feed says they started. */}
            <LiveProvider sports={[sportKey]}>
              <LiveGameScore
                gameId={game.id}
                awayAbbrev={game.away_abbrev}
                homeAbbrev={game.home_abbrev}
                awayScore={showScore ? game.away_score : null}
                homeScore={showScore ? game.home_score : null}
                status={game.status}
              />
            </LiveProvider>
            {(ats || ou) && (
              <div className="ats-tags ats-tags--header" aria-label="Result against the closing line">
                {ats && <span className={`ats-tag ats-tag--${ats.side === 'push' ? 'push' : 'cover'}`}>{ats.label}</span>}
                {ou && <span className={`ats-tag ats-tag--${ou.result}`}>{ou.label}</span>}
              </div>
            )}
            <p className="nfl-game-header__brief">{game.brief || brief}</p>
            <div className="follow-row">
              {[
                { abbrev: game.away_abbrev, full: game.away_team },
                { abbrev: game.home_abbrev, full: game.home_team },
              ].filter(t => t.abbrev).map(t => (
                <FollowStar
                  key={t.abbrev}
                  team={{
                    sport: sportKey,
                    abbrev: t.abbrev,
                    name: teamShortName(sportKey, t.abbrev, t.full),
                    logo: teamLogoUrl(sportKey, t.abbrev),
                  }}
                />
              ))}
            </div>
          </header>

          {hasMarket && (
            <section className="nfl-game-market reveal" aria-label="Market">
              <div className="nfl-game-market__grid">
                <span className="desk-chip">
                  <span className="desk-chip__key">Spread</span>
                  {spreadText ? (
                    <span className="desk-chip__val">
                      {spreadText}
                      {spreadMove && (
                        <span className={`desk-chip__move desk-chip__move--${spreadMove.delta > 0 ? 'up' : 'down'}`}>
                          {spreadMove.label}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="desk-chip__val desk-chip__val--none">&mdash;</span>
                  )}
                </span>
                <span className="desk-chip">
                  <span className="desk-chip__key">Total</span>
                  {totalNow !== null ? (
                    <span className="desk-chip__val">
                      {totalNow}
                      {totalMove && (
                        <span className={`desk-chip__move desk-chip__move--${totalMove.delta > 0 ? 'up' : 'down'}`}>
                          {totalMove.label}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="desk-chip__val desk-chip__val--none">&mdash;</span>
                  )}
                </span>
                <span className="desk-chip">
                  <span className="desk-chip__key">{game.away_abbrev} ML</span>
                  <span className={`desk-chip__val${awayMl ? '' : ' desk-chip__val--none'}`}>
                    {awayMl ?? '—'}
                  </span>
                </span>
                <span className="desk-chip">
                  <span className="desk-chip__key">{game.home_abbrev} ML</span>
                  <span className={`desk-chip__val${homeMl ? '' : ' desk-chip__val--none'}`}>
                    {homeMl ?? '—'}
                  </span>
                </span>
              </div>
              <div className="gs-market-foot">
                {publicGame.odds_provider ? (
                  <p className="nfl-game-market__attrib">
                    Lines via {publicGame.odds_provider}. Odds shown for reference only.
                  </p>
                ) : <span />}
                {(spreadText || totalNow !== null) && <CopyLineButton text={copyText} />}
              </div>
            </section>
          )}

          {adminPanel}

          {/* The breakdown — elite-only IP. Non-elite readers get word count
              and a CTA; the HTML itself never leaves the server for them. */}
          {hasElite && words > 0 && (
            <article
              className="blog-post__content nfl-game-writeup"
              dangerouslySetInnerHTML={{ __html: game.writeup_html }}
            />
          )}
          {/* Write-ups are retired (Ed, Nov 2026): the locked "breakdown is
              inside" card is gone. An old write-up still renders above for
              the readers who can open it. The bets take its place. */}
          {bets.length > 0 && <BetsSection bets={bets} />}

          {/* Linked systems & trends */}
          {(systems.visible.length + systems.locked.length + systems.lockedElite.length > 0) && (
            <LinkedSection
              title="Systems on this game"
              visible={systems.visible}
              locked={systems.locked}
              lockedElite={systems.lockedElite}
              href="/vault/systems"
              closed={researchClosed}
            />
          )}
          {(trends.visible.length + trends.locked.length + trends.lockedElite.length > 0) && (
            <LinkedSection
              title="Trends on this game"
              visible={trends.visible}
              locked={trends.locked}
              lockedElite={trends.lockedElite}
              href="/vault/trends"
              closed={researchClosed}
            />
          )}

          {/* Free context: injuries, kickoff forecast, headlines. */}
          <GameIntel
            sport={params.sport}
            gameId={game.id}
            status={game.status}
            homeTeam={game.home_team}
            awayTeam={game.away_team}
            homeAbbrev={game.home_abbrev}
            awayAbbrev={game.away_abbrev}
            game={game}
            homeSeason={homeSeason}
            awaySeason={awaySeason}
            linkedCount={linkedCount}
            betsCount={bets.length}
          />

          {/* Say so rather than ending the page. Admins see this too. */}
          {!hasResearch && (
            <div className="nfl-game-empty reveal">
              <h2 className="nfl-game-empty__title">No research added yet</h2>
              <p className="nfl-game-empty__text">
                Nothing has been attached to this matchup yet. The systems and trends
                that qualify, and the bets on it, land here as
                the week fills in — check back closer to {startWord(params.sport)}.
              </p>
              <Link href={`/desk/${params.sport}`} className="nfl-game-empty__link">
                See the rest of the week &rarr;
              </Link>
            </div>
          )}

          {/* Front door: a light free-account ask for logged-out readers. */}
          {!user && (
            <SignupPrompt
              context="desk_game"
              className="fd-desk-prompt"
              variant="banner"
              title="Follow this week free."
              body="A free account gets you the free picks and an alert when one drops."
            />
          )}
        </div>
      </section>

      {/* Where to go next. Its own section, after the main one, so it reads as
          navigation rather than as part of the matchup's research. */}
      <section className="section game-nav-section" aria-label="More from the Desk">
        <div className="container" style={{ maxWidth: '900px' }}>
          <div className="game-nav">
            {teamNav.map(t => (
              <div className="game-nav__team" key={t.abbrev}>
                <h2 className="game-nav__title">
                  <Link href={teamPath(sportKey, t.abbrev)}>{t.name}</Link>
                </h2>
                <Link href={teamPath(sportKey, t.abbrev)} className="game-nav__more">
                  {t.abbrev} schedule &amp; ATS record &rarr;
                </Link>
                <div className="game-nav__steps">
                  {t.prev ? (
                    <Link href={gamePath(sportKey, t.prev.slug)} className="game-nav__step">
                      <span className="game-nav__step-key">&larr; Previous</span>
                      <span className="game-nav__step-val">{matchupFor(t.prev, t.abbrev)}</span>
                    </Link>
                  ) : <span className="game-nav__step game-nav__step--none">First game of the season</span>}
                  {t.next ? (
                    <Link href={gamePath(sportKey, t.next.slug)} className="game-nav__step game-nav__step--next">
                      <span className="game-nav__step-key">Next &rarr;</span>
                      <span className="game-nav__step-val">{matchupFor(t.next, t.abbrev)}</span>
                    </Link>
                  ) : <span className="game-nav__step game-nav__step--none game-nav__step--next">No later game posted</span>}
                </div>
              </div>
            ))}
          </div>

          {dayName && sameDay.length > 0 && (
            <div className="game-day">
              <h2 className="game-nav__title">Other games {dayName}</h2>
              <ul className="game-day__list">
                {dayLinks.map(r => {
                  const tag = atsTag(r)
                  return (
                    <li key={r.id}>
                      <Link href={gamePath(sportKey, r.slug)} className="game-day__link">
                        <span>{r.away_abbrev} at {r.home_abbrev}</span>
                        {r.status === 'post' && r.home_score !== null && r.away_score !== null ? (
                          <span className="game-day__meta">{r.away_score}-{r.home_score}{tag ? ` · ${tag.label}` : ''}</span>
                        ) : r.spread_current != null ? (
                          <span className="game-day__meta">{spreadLabel(r.spread_current, r.home_abbrev, r.away_abbrev)}</span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
              <Link href={dayBoardHref} className="game-nav__more">
                {sameDay.length > dayLinks.length
                  ? `All ${sameDay.length + 1} games that day on the board →`
                  : 'See the board →'}
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

/** "vs MIA · Oct 12" or "@ MIA · Oct 12", from one team's side of a game. */
function matchupFor(g: Pick<NflGame, 'home_abbrev' | 'away_abbrev' | 'kickoff'>, abbrev: string): string {
  const home = g.home_abbrev === abbrev
  const opp = home ? g.away_abbrev : g.home_abbrev
  const day = g.kickoff
    ? new Date(g.kickoff).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })
    : 'TBD'
  return `${home ? 'vs' : '@'} ${opp} · ${day}`
}

/**
 * Badge text for a curated row, from the row itself.
 *
 * SPORT_SHORT is the shared badge map (lib/desk.ts) and is what the Vault pages
 * label these same rows with, so a trend reads CFB in both places. Falls back to
 * the raw value uppercased rather than to a league name, because guessing wrong
 * here is what produced the bug this replaces.
 */
function sportBadge(sport: string | null | undefined): string {
  const key = (sport ?? '').trim()
  return SPORT_SHORT[key as keyof typeof SPORT_SHORT] ?? key.toUpperCase() ?? ''
}

interface GameBet {
  key: string
  free: boolean
  locked: boolean
  bet: string | null
  odds: number | null
  result: 'pending' | 'win' | 'loss' | 'push'
  note: string | null
}

function oddsText(odds: number | null): string | null {
  if (odds === null || odds === undefined || !Number.isFinite(odds)) return null
  return odds > 0 ? `+${odds}` : String(odds)
}

/** What is being bet on this game: Ed's free picks and the Portfolio picks. */
function BetsSection({ bets }: { bets: GameBet[] }) {
  const anyLocked = bets.some(b => b.locked)
  return (
    <div className="nfl-linked-section game-bets reveal">
      <h2 className="nfl-linked-section__title">Bets on this game</h2>
      <ul className="game-bets__list">
        {bets.map(b => (
          <li key={b.key} className={`game-bets__item${b.locked ? ' is-locked' : ''}`}>
            <span className={`game-bets__tag${b.free ? ' is-free' : ''}`}>{b.free ? 'Free' : 'Portfolio'}</span>
            {b.locked ? (
              <span className="game-bets__bet game-bets__bet--locked">
                <IconLock size={12} /> Portfolio pick
              </span>
            ) : (
              <Link href={`/picks/${encodeURIComponent(b.key)}`} className="game-bets__bet">
                {b.bet ?? 'Pick'}
                {oddsText(b.odds) && <span className="game-bets__odds">{oddsText(b.odds)}</span>}
              </Link>
            )}
            {b.result !== 'pending' && (
              <span className={`game-bets__result is-${b.result}`}>{b.result.toUpperCase()}</span>
            )}
            {!b.locked && b.note && <span className="game-bets__note">{b.note}</span>}
          </li>
        ))}
      </ul>
      {anyLocked && (
        <p className="game-bets__more">
          Portfolio picks open with the <Link href="/win?plan=portfolio">EdTheStatBot Portfolio</Link> or
          the <Link href="/win?plan=desk">Research Desk</Link>.
        </p>
      )}
    </div>
  )
}

function LinkedSection({ title, visible, locked, lockedElite, href, closed }: {
  title: string
  visible: any[]
  locked: LockedTeaser[]
  lockedElite: LockedTeaser[]
  href: string
  /** The week is over, so the Desk rung's in-context window has shut. */
  closed: boolean
}) {
  return (
    <div className="nfl-linked-section reveal">
      <h2 className="nfl-linked-section__title">{title}</h2>
      {/* Say why, or a Desk member who could read this last week reads a
          generic upgrade prompt on research they already paid for and
          reasonably concludes something is broken. */}
      {closed && (
        <p className="nfl-linked-section__closed">
          <IconLock size={12} />
          {/* One span, not loose text: the parent is a flex row, so every bare
              text node and the link would each become their own flex item and
              the link would be flung to the far edge. */}
          <span>
            This week has been played, so its research is closed. The records stay
            on the board; the systems and trends behind them live in{' '}
            <Link href="/vault">the Vault</Link>.
          </span>
        </p>
      )}
      <div className="sys-card-grid">
        {visible.map(row => (
          <div key={row.id} className={`sys-row-card sys-row-card--${row.sport}`}>
            <div className="sys-row-card__body">
              <div className="sys-row-card__sport-col">
                {/* The row's OWN sport. This said 'NFL' for anything that was
                    not nflpre -- written when the Desk was NFL-only -- so a
                    Rutgers trend curated onto a college game wore an NFL badge
                    while its code right underneath it read RUTGT00002. The
                    colour beside it was already sport-driven, which made the
                    mismatch look like a rendering bug rather than a label. */}
                <span className="sys-row-card__sport-badge">{sportBadge(row.sport)}</span>
              </div>
              <div className="sys-row-card__desc-col">
                <div className="sys-row-card__desc">{row.description}</div>
                {/* The Vault key, so a row can be found again in the library. */}
                {row.code && <span className="sys-row-card__field-value">{row.code}</span>}
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
          <LockedTeaserCard key={t.id} teaser={t} sportLabel={sportBadge(t.sport)} sportClass={t.sport} variant="elite" noun={href.includes('trend') ? 'trend' : 'system'} />
        ))}
        {locked.map(t => (
          <LockedTeaserCard key={t.id} teaser={t} sportLabel={sportBadge(t.sport)} sportClass={t.sport} noun={href.includes('trend') ? 'trend' : 'system'} />
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
