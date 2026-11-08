import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CTASection from '@/components/CTASection'
import DeskWeekBoard from '@/components/DeskWeekBoard'
import NflAdminBar from '@/components/NflAdminBar'
import DeskLiveRefresh from '@/components/DeskLiveRefresh'
import PricingCards from '@/components/PricingCards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/lib/access-server'
import { researchClosedFor, holdsLibrary } from '@/lib/gate'
import { toPublicGame, currentWeekOf, weekLabel, weekIsOver } from '@/lib/nfl'
import type { NflGame, PublicNflGame } from '@/lib/nfl'
import {
  DESK_SPORTS, deskSportLabel, deskSeasonLabel, defaultDeskSeason, startWord,
  weeksFromDates, isYmd, dateWeekOfDay, dateWeekDays, deskToday, addDays, easternDate,
} from '@/lib/desk'
import { selectAll } from '@/lib/supabase/select-all'
import { createClient } from '@/lib/supabase/server'
import { loadTrialState, type TrialState } from '@/lib/trial'

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  { params }: { params: { sport: string } }
): Promise<Metadata> {
  const label = deskSportLabel(params.sport)
  const title = `The Research Desk — ${label}`
  const description = `Every ${label} game on one schedule, with the betting trends curated for that matchup, opening and current lines, and the bets on each game.`
  const url = `https://edthestatman.com/desk/${params.sport}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | EdTheStatMan.com`, description, url, images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: `${title} | EdTheStatMan.com`, description, images: ['/og-cover.jpg'] },
  }
}

export default async function DeskSport({
  params,
  searchParams,
}: {
  params: { sport: string }
  searchParams: { week?: string; type?: string; day?: string; all?: string }
}) {
  const sport = params.sport.toLowerCase()
  if (!DESK_SPORTS.includes(sport as any)) notFound()

  const admin = createAdminClient()

  // `nfl_games` is neither one season nor one league. Completed seasons are
  // backfilled into it so the Vault's situational rules have a history to check
  // against, so an unscoped read stacks 2024's Week 1 underneath the current one
  // and the board opens on whichever season happens to sort first. The board is
  // always the newest season this viewer is allowed to see: published rows for a
  // visitor, any row for an admin, so next season can be synced and staged before
  // a game of it is published. Neither probe needs the access check, so both ride
  // along with it rather than adding a round trip.
  const latestSeason = (published: boolean) => {
    let q = (admin as any)
      .from('nfl_games')
      .select('season')
      .eq('sport', sport)
      .order('season', { ascending: false })
      .limit(1)
    if (published) q = q.eq('is_published', true)
    return q.maybeSingle()
  }

  const [access, publishedSeason, anySeason] = await Promise.all([
    getAccess(),
    latestSeason(true),
    latestSeason(false),
  ])
  const { tier: userTier, isAdmin, membership } = access

  const season: number =
    (isAdmin ? anySeason?.data?.season : publishedSeason?.data?.season)
    ?? publishedSeason?.data?.season
    ?? defaultDeskSeason(sport)

  // The schedule itself is the public shell — a visitor should be able to see
  // that the board exists and how much is on it. The curated research attached
  // to each game is what the Desk rung buys.
  const hasDesk = isAdmin || access.atLeast('desk')

  // The free-trial button on the paywall. Only for a signed-in visitor without
  // the Desk -- the one case the paywall renders for someone who could start
  // one -- so nobody else pays for the extra auth round trip.
  let trial: TrialState = { available: false, onTrial: false, endsAt: null }
  if (!hasDesk && membership !== 'logged-out') {
    const { data: { user } } = await (await createClient()).auth.getUser()
    trial = await loadTrialState(admin, user?.id)
  }

  // The week rail needs every week of the season but none of the payload, so it
  // reads four columns and the board reads one week of rows. A college season is
  // roughly 1,400 games against the NFL's 272: pulling all of them with `*` to
  // render a single week of cards is the shape that stops working the moment a
  // second league lands.
  const { data: weekRows } = await selectAll(() => (admin as any)
    .from('nfl_games')
    .select('season_type, week, kickoff, status, is_published')
    .eq('sport', sport)
    .eq('season', season)
    .order('id'))

  type WeekRow = Pick<NflGame, 'season_type' | 'week' | 'kickoff' | 'status' | 'is_published'>
  const visibleWeekRows: WeekRow[] = (weekRows ?? []).filter(
    (r: WeekRow) => r.is_published || isAdmin
  )

  // Week list derived from data — nothing hardcodes a week count.
  const weekMap = new Map<string, { season_type: number; week: number }>()
  for (const r of visibleWeekRows) {
    weekMap.set(`${r.season_type}-${r.week}`, { season_type: r.season_type, week: r.week })
  }
  const weeks = [...weekMap.values()]
    .sort((a, b) => a.season_type - b.season_type || a.week - b.week)
    .map(w => ({ ...w, label: weekLabel(w.season_type, w.week, sport, season) }))

  let requestedType: number | null = searchParams.type === 'post' ? 3 : searchParams.week ? 2 : null
  let requestedWeek: number | null = Number(searchParams.week) || null

  // Basketball reads a night at a time (see "Basketball days" in lib/desk.ts).
  // A ?day= with no ?week= -- the game page's "all games that day" link -- names
  // its own week, so the date is enough to land on the right board.
  const dated = weeksFromDates(sport)
  const requestedDay = dated && isYmd(searchParams.day) ? searchParams.day : null
  if (requestedDay && !searchParams.week) {
    const w = dateWeekOfDay(season, requestedDay)
    const hit = weeks.find(x => x.week === w)
    if (hit) {
      requestedType = hit.season_type
      requestedWeek = hit.week
    }
  }

  // No week in the URL means the reader arrived from somewhere else -- the nav,
  // a bookmark, the Portfolio and back -- and a bare board opens on the week
  // that is actually current: the earliest one with a game still to play.
  //
  // Nothing is remembered here on purpose. This used to prefer a per-sport
  // cookie holding the last week viewed, which meant clicking back through
  // September and returning the next day reopened September. The week is in the
  // URL, so a reload, a bookmark and a shared link all still hold it; only a
  // bare Desk link resets, which is the behaviour the board is for. See
  // lib/desk-place.ts.
  const fallback = currentWeekOf(visibleWeekRows, new Date())
  const active =
    requestedType && requestedWeek && weekMap.has(`${requestedType}-${requestedWeek}`)
      ? { season_type: requestedType, week: requestedWeek }
      : fallback ?? null

  const { data: gamesData } = active
    ? await (admin as any)
        .from('nfl_games')
        .select('*')
        .eq('sport', sport)
        .eq('season', season)
        .eq('season_type', active.season_type)
        .eq('week', active.week)
        .order('kickoff', { ascending: true, nullsFirst: false })
    : { data: [] }

  const weekGames: PublicNflGame[] = (gamesData ?? [])
    .filter((g: NflGame) => g.is_published || isAdmin)
    .map(toPublicGame)

  // ---- Day strip and line filter (basketball) -------------------------------
  // The week is still the key; a day narrows the board inside it. It defaults
  // to the Desk's today (rolling at 4am Eastern) when today is in the week on
  // screen, and to the whole week otherwise -- a past or future week has no
  // "tonight" to open on. ?day=week asks for the whole week explicitly.
  //
  // Everything here is decided on the SERVER and handed down as labels, so the
  // client never reads a clock to decide what "Today" means.
  const today = deskToday()
  const weekDays = dated && active ? dateWeekDays(season, active.week) : []
  const activeDay: string | null = !dated || searchParams.day === 'week'
    ? null
    : requestedDay && weekDays.includes(requestedDay)
      ? requestedDay
      : weekDays.includes(today) ? today : null

  // Most of a college basketball week never gets a line: 250 to 470 games, the
  // bulk of them small-school matchups ESPN does not price. Those cards are a
  // schedule entry and nothing else, so the board opens on the priced games and
  // ?all=1 brings the rest back.
  const lineFilterOn = sport === 'cbb' && searchParams.all !== '1'
  const hasLine = (g: PublicNflGame) =>
    g.spread_current != null || g.spread_open != null || g.total_current != null || g.total_open != null
  const onDay = (g: PublicNflGame, day: string) => Boolean(g.kickoff) && easternDate(g.kickoff!) === day

  const dayGames = activeDay ? weekGames.filter(g => onDay(g, activeDay)) : weekGames
  const boardGames = lineFilterOn ? dayGames.filter(hasLine) : dayGames
  const hiddenByLine = dayGames.length - boardGames.length

  const relative: Record<string, string> = {
    [addDays(today, -1)]: 'Yesterday',
    [today]: 'Today',
    [addDays(today, 1)]: 'Tomorrow',
  }
  const dayOptions = weekDays.map(date => {
    const noon = new Date(`${date}T12:00:00Z`)
    return {
      date,
      label: relative[date] ?? noon.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      sub: noon.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }),
      count: weekGames.filter(g => onDay(g, date) && (!lineFilterOn || hasLine(g))).length,
    }
  })

  // The link counts and the bet counts both depend only on `active`, so they go
  // out together. They used to run in series, which cost a whole extra Supabase
  // round trip (~200ms measured) on the render path of a page that already
  // blocks on auth and the full game list before either can start.
  //
  // Counted for the games actually on the board, not the whole week: a college
  // basketball week is several hundred ids, which is a very long `in` filter to
  // send for cards that are not being rendered.
  const gameIds = boardGames.map(g => g.id)

  const [linkRows, betRows] = await Promise.all([
    // Curated link counts per game — proof of depth without shipping the links.
    gameIds.length > 0
      ? Promise.all([
          (admin as any).from('nfl_game_systems').select('game_id').in('game_id', gameIds),
          (admin as any).from('nfl_game_trends').select('game_id').in('game_id', gameIds),
        ])
      : Promise.resolve([{ data: [] }, { data: [] }] as any[]),
    // The bets on each game (todays_bets.game_id, lib/picks/game-match.ts).
    // Before pricing_01 the column is missing, the query errors, and every
    // count is simply zero.
    gameIds.length > 0
      ? (admin as any)
          .from('todays_bets')
          .select('game_id, is_active, show_on_results')
          .in('game_id', gameIds)
      : Promise.resolve({ data: [] }),
  ])

  const betCounts: Record<string, number> = {}
  for (const row of (betRows as any)?.data ?? []) {
    // Same "is it public" rule as lib/picks/public.ts: an inactive pick that
    // was never published is still a draft.
    if (row.is_active === false && row.show_on_results !== true) continue
    betCounts[row.game_id] = (betCounts[row.game_id] ?? 0) + 1
  }
  // Plus the bets typed into each game's write-up, which have no todays_bets row.
  for (const g of boardGames) {
    if (g.writeup_bets > 0) betCounts[g.id] = (betCounts[g.id] ?? 0) + g.writeup_bets
  }

  const [sysLinks, trendLinks] = linkRows as any[]
  const linkedCounts: Record<string, { systems: number; trends: number }> = {}
  for (const id of gameIds) linkedCounts[id] = { systems: 0, trends: 0 }
  for (const row of sysLinks?.data ?? []) if (linkedCounts[row.game_id]) linkedCounts[row.game_id].systems++
  for (const row of trendLinks?.data ?? []) if (linkedCounts[row.game_id]) linkedCounts[row.game_id].trends++

  // Is the week on screen already played out? If so the Desk rung's in-context
  // window on it has shut, and the cards must say so rather than advertise a
  // count the reader cannot open. Free here: visibleWeekRows is already loaded
  // for the rail, so this is a filter, not a query. See researchClosedFor().
  const activeWeekRows = active
    ? visibleWeekRows.filter(
        r => r.season_type === active.season_type && r.week === active.week
      )
    : []
  const researchClosed = researchClosedFor(
    { weekOver: weekIsOver(activeWeekRows, new Date()) },
    holdsLibrary(userTier, isAdmin)
  )

  const label = deskSportLabel(sport)
  const seasonLabel = deskSeasonLabel(sport, season)

  // Is this week worth watching? A game in progress, or one close enough to
  // kickoff that it is about to be. Decided on the SERVER so the client never
  // reaches for a clock during render and disagrees with the HTML it hydrates
  // -- the same reason groupSlate() orders on `status` and never on Date.now().
  //
  // The kickoff window matters as much as the live check: a board loaded five
  // minutes before the first game would otherwise sit there through kickoff,
  // showing `pre`, because nothing was live at the moment it rendered.
  const KICKOFF_SOON_MS = 30 * 60 * 1000
  const nowMs = Date.now()
  const weekIsLive = weekGames.some(g => {
    if (g.status === 'in') return true
    if (g.status !== 'pre' || !g.kickoff) return false
    return new Date(g.kickoff).getTime() - nowMs <= KICKOFF_SOON_MS
  })

  return (
    <main>
      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">The Research Desk</span>
            <h1 className="section-title">{label} {seasonLabel}</h1>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              The whole season on one board. Every game, the line and how it has moved,
              and the trends we have pulled for that specific matchup.
            </p>
          </div>

          {/* Keeps this board current while it is open. Renders a status line
              only when something is actually live; otherwise it does one
              catch-up sync on arrival and shows nothing. */}
          <DeskLiveRefresh sport={sport} live={weekIsLive} />

          {DESK_SPORTS.length > 1 && (
            <div className="desk-sports">
              {DESK_SPORTS.map(s => (
                <Link
                  key={s}
                  href={`/desk/${s}`}
                  className={`desk-sport-pill${s === sport ? ' is-active' : ''}`}
                >
                  {deskSportLabel(s)}
                </Link>
              ))}
            </div>
          )}

          {isAdmin && (
            <NflAdminBar sport={sport} season={season} seasonLabel={seasonLabel} seasonType={active?.season_type} week={active?.week} />
          )}

          {weeks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
              The {seasonLabel} {label} schedule lands here soon — check back before {startWord(sport)}.
            </div>
          ) : (
            <DeskWeekBoard
              sport={sport}
              games={boardGames}
              days={dated ? { options: dayOptions, active: activeDay } : null}
              lineFilter={sport === 'cbb' ? { on: lineFilterOn, hidden: hiddenByLine } : null}
              weeks={weeks}
              active={active}
              linkedCounts={linkedCounts}
              betCounts={betCounts}
              hasDesk={hasDesk}
              hasWriteups={access.hasElite}
              isAdmin={isAdmin}
              researchClosed={researchClosed}
            />
          )}
        </div>
      </section>

      {!hasDesk && (
        <section className="section" style={{ background: 'var(--bg-secondary)' }} id="pricing">
          <div className="container">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <span className="section-label">Membership</span>
              <h2 className="section-title">Pull up a <span className="text-gradient">chair</span></h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>
                The Research Desk opens every matchup: the systems and trends behind
                it, the bets on it, the whole Handicapping Vault and every Portfolio
                pick. Try it free for 7 days, no card needed.
              </p>
            </div>
            <div style={{ marginTop: '60px' }}>
              <PricingCards membership={membership} currentTier={userTier} expiresAt={access.expiresAt?.toISOString() ?? null} highlight="desk" trial={trial} />
            </div>
          </div>
        </section>
      )}

      <CTASection membership={membership} />
    </main>
  )
}
