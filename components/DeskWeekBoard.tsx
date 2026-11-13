'use client'

import { useState, useEffect, useRef, useCallback, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useLive } from './live/LiveProvider'
import type { PublicNflGame } from '@/lib/nfl'
import { spreadLabel, moneylineLabel, lineMove, groupSlate, gamePath } from '@/lib/nfl'
import { IconLock, IconArrowRight, IconChevronLeft, IconChevronRight } from './Icons'
import { teamLogoUrl } from '@/lib/logos'
import { atsTag, ouTag } from '@/lib/ats'
import '@/styles/seo-desk.css'
import '@/styles/desk-v2.css'
import { CFB_SCHOOLS } from '@/lib/teams-cfb'
import { CBB_SCHOOLS } from '@/lib/teams-cbb'
import {
  DESK_SPORT_COOKIE, DESK_PLACE_MAX_AGE, retiredDeskWeekCookie,
} from '@/lib/desk-place'

interface WeekOption {
  season_type: number
  week: number
  label: string
}

interface Props {
  sport: string
  games: PublicNflGame[]
  weeks: WeekOption[]
  active: { season_type: number; week: number } | null
  /** Curated systems/trends attached to each game — depth without the payload. */
  linkedCounts: Record<string, { systems: number; trends: number }>
  /** Free and Portfolio picks attached to each game (todays_bets.game_id). */
  betCounts?: Record<string, number>
  /** Whether this member holds the Research Desk rung or better. */
  hasDesk: boolean
  /** Legacy: game write-ups open with the Vault. No longer shown on the board. */
  hasWriteups: boolean
  isAdmin: boolean
  /**
   * The week on screen has been played out, so the Desk rung's in-context
   * window on it is shut. Already resolved for this viewer by the server:
   * false for admins and for anyone who holds the library outright.
   */
  researchClosed: boolean
  /**
   * Basketball's day strip: the days of the active week and which one the board
   * is filtered to (null = the whole week). Labels arrive from the server,
   * "Today" included, so nothing here reads a clock. Null for football.
   */
  days?: { options: DayOption[]; active: string | null } | null
  /**
   * College basketball's "Has a line" filter. `hidden` is how many games on the
   * current day (or week) it is holding back. Null where the filter is not offered.
   */
  lineFilter?: { on: boolean; hidden: number } | null
  /**
   * The side rail (next up, line movers), rendered beside the games on a wide
   * screen and above them on a narrow one. Built on the server by the page.
   */
  aside?: ReactNode
  /** Rendered above the games when there is no rail (e.g. the NextUp bar). */
  band?: ReactNode
}

interface DayOption {
  date: string
  label: string
  sub: string
  count: number
}

const STATUS_LABEL: Record<string, string> = { pre: '', in: 'LIVE', post: 'FINAL' }

function kickoffDisplay(kickoff: string | null, tbd?: boolean | null): string {
  if (!kickoff) return 'TBD'
  // ESPN has the date but not the time: the clock part is a midnight placeholder.
  if (tbd) {
    return `${new Date(kickoff).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' })} TBD`
  }
  return new Date(kickoff).toLocaleString('en-US', {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York',
  })
}

/** "today" / "tomorrow" / "on Thu Nov 13", from the server's day labels. */
function dayPhrase(label: string, sub?: string): string {
  if (label === 'Today' || label === 'Tomorrow' || label === 'Yesterday') return label.toLowerCase()
  return sub ? `on ${label} ${sub}` : `on ${label}`
}

/**
 * What the card calls a team.
 *
 * The two leagues want opposite halves of the same string. In the NFL the city
 * is already on the abbreviation tile, so the card leads with the mascot:
 * "Bengals", not "Cincinnati Bengals". In college the mascot is the useless
 * half — of the 243 programs in CFB_SCHOOLS, nine are Wildcats, nine are Tigers
 * and eight are Bulldogs, so a board of mascots cannot be read at all — and it
 * is the school that identifies the team.
 *
 * College cannot take the school off the string, which is why the table exists:
 * "Alabama Crimson Tide" is Alabama and "Alabama State Hornets" is Alabama
 * State, identically shaped and different answers. Dropping the last word is
 * wrong for 37 of the 243 teams. A team missing from the table falls back to
 * its full stored name, which is long but never wrong.
 */
function teamName(sport: string, team: string, abbrev: string): string {
  if (sport === 'cfb') return CFB_SCHOOLS[abbrev] ?? team
  if (sport === 'cbb') return CBB_SCHOOLS[abbrev] ?? team
  const parts = team.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : team
}

export default function DeskWeekBoard({
  sport, games, weeks, active, linkedCounts, betCounts = {}, hasDesk, hasWriteups, isAdmin, researchClosed,
  days = null, lineFilter = null, aside = null, band = null,
}: Props) {
  // Live scores and clock from the front page's feed (/api/live, CDN-cached),
  // between the Desk's own syncs. Empty outside a LiveProvider.
  const { byId: liveById } = useLive()
  const router = useRouter()
  const pathname = usePathname()

  // Remember the LEAGUE, so the nav and a bare /desk return you to the board you
  // were on. The week is deliberately not remembered: it would beat the current
  // week on every bare visit, which is the one thing the board must not do. See
  // lib/desk-place.ts.
  //
  // The second line expires the week cookie this component used to write, so a
  // reader already carrying one is not steered by a value nothing reads any more.
  // Both it and `retiredDeskWeekCookie` can go once those have aged out.
  useEffect(() => {
    document.cookie = `${DESK_SPORT_COOKIE}=${sport}; path=/; max-age=${DESK_PLACE_MAX_AGE}; samesite=lax`
    document.cookie = `${retiredDeskWeekCookie(sport)}=; path=/; max-age=0; samesite=lax`
  }, [sport])

  // Switching weeks is a server round trip on a force-dynamic page, and React
  // holds the old screen while it runs. Without a pending state the board looks
  // inert for the whole trip: the pill you clicked does not light up, nothing
  // moves, and the natural read is that the click missed.
  const [isPending, startTransition] = useTransition()
  const [requested, setRequested] = useState<{ season_type: number; week: number } | null>(null)

  // Show the requested week as selected the moment it is clicked. When the
  // transition ends this falls back to `active`, which by then is the server's
  // answer — so a failed or superseded navigation cannot leave the rail lying.
  const shown = isPending && requested ? requested : active

  // Selected week lives in the URL so it survives refresh and sharing — the
  // same pattern the sport tabs use on the Vault pages.
  //
  // A new week drops the day, so it opens on its own default (today if today is
  // in it, the whole week otherwise), and keeps the line filter as it was.
  function selectWeek(w: WeekOption) {
    if (shown && shown.season_type === w.season_type && shown.week === w.week) return
    setRequested({ season_type: w.season_type, week: w.week })
    const params = new URLSearchParams()
    params.set('week', String(w.week))
    if (w.season_type === 3) params.set('type', 'post')
    if (lineFilter && !lineFilter.on) params.set('all', '1')
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  // Day and line filter: same URL-driven, optimistic pattern as the week rail.
  // `undefined` means "nothing requested", which is distinct from null (the
  // whole week).
  const [requestedDay, setRequestedDay] = useState<string | null | undefined>(undefined)
  const [requestedLines, setRequestedLines] = useState<boolean | undefined>(undefined)
  const shownDay = isPending && requestedDay !== undefined ? requestedDay : days?.active ?? null
  const linesOn = isPending && requestedLines !== undefined ? requestedLines : Boolean(lineFilter?.on)

  function boardHref(day: string | null, lines: boolean): string {
    const params = new URLSearchParams()
    if (active) {
      params.set('week', String(active.week))
      if (active.season_type === 3) params.set('type', 'post')
    }
    // "week" rather than no param: no param means "today if it is in this week".
    params.set('day', day ?? 'week')
    if (lineFilter && !lines) params.set('all', '1')
    return `${pathname}?${params.toString()}`
  }

  function selectDay(day: string | null) {
    if (day === shownDay) return
    setRequestedDay(day)
    setRequestedLines(undefined)
    startTransition(() => {
      router.replace(boardHref(day, linesOn), { scroll: false })
    })
  }

  function toggleLines() {
    const next = !linesOn
    setRequestedLines(next)
    setRequestedDay(undefined)
    startTransition(() => {
      router.replace(boardHref(shownDay, next), { scroll: false })
    })
  }

  // ---- Week rail scrolling -------------------------------------------------
  // The rail holds up to 23 pills for the NFL and 17 for college, well past
  // what fits, and it hides its scrollbar. The edge fades say there is more
  // without saying how to reach it, which leaves a trackpad or a drag as the
  // only way across.
  const rail = useRef<HTMLDivElement | null>(null)
  // Assume there is somewhere to go, because with this many weeks there almost
  // always is. Guessing wrong for one frame is better than the buttons popping
  // in after the measurement.
  const [reach, setReach] = useState({ back: false, on: true })

  const measure = useCallback(() => {
    const el = rail.current
    if (!el) return
    // A pixel of slack: fractional scroll positions are normal at any zoom
    // other than 100%, and an exact comparison leaves the button enabled at
    // the end of the rail with nothing left to scroll to.
    const end = el.scrollWidth - el.clientWidth
    setReach({ back: el.scrollLeft > 1, on: el.scrollLeft < end - 1 })
  }, [])

  useEffect(() => {
    const el = rail.current
    if (!el) return
    measure()
    el.addEventListener('scroll', measure, { passive: true })
    // Watches the element rather than the window: the rail also changes width
    // when the sport switches under it, which no resize event would report.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [measure, weeks])

  // Open with the active week actually on screen.
  //
  // The board opens on the current week, but the rail starts at Week 1 and the
  // active pill is simply off to the right of it. By Week 11 there is nothing on
  // screen to say which week you are looking at, and a board that is showing
  // November reads like it opened on the first week of the season.
  //
  // Measured with rects and moved by setting `scrollLeft` on the rail itself,
  // NOT with scrollIntoView and NOT with offsetLeft. `.desk-weeks` is not a
  // positioned element, so a pill's offsetParent is an ancestor rather than the
  // rail and its offsetLeft does not answer the question being asked here. And
  // scrollIntoView scrolls every scrollable ancestor it needs to, including the
  // page, which on arrival would drop the reader past the heading and onto the
  // rail. Nothing outside the rail moves.
  const activeKey = active ? `${active.season_type}-${active.week}` : null
  useEffect(() => {
    const el = rail.current
    if (!el || !activeKey) return
    const pill = el.querySelector<HTMLElement>('.desk-week-pill.is-active')
    if (!pill) return
    const pillBox = pill.getBoundingClientRect()
    const railBox = el.getBoundingClientRect()
    // Already fully visible: leave it alone, so a re-render never nudges a rail
    // the reader has scrolled somewhere deliberately.
    if (pillBox.left >= railBox.left && pillBox.right <= railBox.right) return
    // Centre it, then let the browser clamp at either end of the rail.
    el.scrollLeft += (pillBox.left - railBox.left) - (railBox.width - pillBox.width) / 2
  }, [activeKey, weeks])

  // Just under a screenful, so the pill you were last looking at stays on
  // screen as an anchor instead of the rail jumping somewhere unrecognisable.
  const scrollRail = (dir: 1 | -1) => {
    const el = rail.current
    if (!el) return
    // Asked here rather than in CSS: an explicit `behavior` on scrollBy wins
    // over `scroll-behavior`, so a stylesheet rule for this would be silently
    // ignored. Jumping straight there loses nothing, the destination is the
    // whole message.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({
      left: dir * Math.round(el.clientWidth * 0.8),
      behavior: still ? 'auto' : 'smooth',
    })
  }

  const scrollable = reach.back || reach.on

  const slate = groupSlate(games)

  // Week header numbers. These are the honest advertisement for the rung: how
  // much research is actually sitting on this week's board.
  // Total systems + trends attached across the week's games, not the number
  // of games that carry any (Ed, Nov 2026).
  const researched = games.reduce((n, g) => {
    const c = linkedCounts[g.id]
    return n + (c ? c.systems + c.trends : 0)
  }, 0)
  // Bets, not write-ups (Ed, Nov 2026): he is not writing game write-ups, he
  // is attaching the free and Portfolio picks to each game. "Lines moved" went
  // the same day -- a count of moved lines told nobody anything.
  const bets = games.reduce((n, g) => n + (betCounts[g.id] ?? 0), 0)
  // A zero is dropped rather than printed. "0 Systems/Trends / 0 Bets" is cells
  // of nothing on most boards most days, and it reads as a broken product
  // rather than an early week. The game count stays: it is the one number
  // that is never noise.
  const summary = [
    { value: games.length, label: games.length === 1 ? 'Game' : 'Games' },
    { value: researched, label: 'Systems/Trends', accent: researched > 0 },
    { value: bets, label: bets === 1 ? 'Bet' : 'Bets', accent: bets > 0 },
  ].filter((s, i) => i === 0 || s.value > 0)

  // When nothing on the board carries research, one quiet line says so. Cards
  // with nothing attached carry no tag: an empty foot reads better than "none".
  // For the lead line and the empty day: the next matchup still to play (by
  // status, never by clock, so server and browser agree), and the next day in
  // the strip that has games on it.
  const nextGame = games.find(g => g.status === 'pre') ?? null
  const activeDayLabel = days?.options.find(d => d.date === days.active)?.label ?? ''
  const nextDay = days && days.active
    ? days.options.find(d => d.date > days.active! && d.count > 0) ?? null
    : null

  const anyResearch = games.some(g => (betCounts[g.id] ?? 0) > 0 || (linkedCounts[g.id]?.systems ?? 0) + (linkedCounts[g.id]?.trends ?? 0) > 0)

  return (
    <div className={`desk-board${isPending ? ' is-switching' : ''}`} aria-busy={isPending}>
      <div className="desk-weeks-rail">
        {scrollable && (
          <button
            type="button"
            className="desk-weeks-nav"
            onClick={() => scrollRail(-1)}
            disabled={!reach.back}
            aria-label="Scroll to earlier weeks"
          >
            <IconChevronLeft size={16} />
          </button>
        )}

        <div className="desk-weeks-wrap">
          <div className="desk-weeks" ref={rail} role="tablist" aria-label="Week">
          {weeks.map(w => {
            const isActive = !!shown && shown.season_type === w.season_type && shown.week === w.week
            return (
              <button
                key={`${w.season_type}-${w.week}`}
                role="tab"
                aria-selected={isActive}
                className={`desk-week-pill${isActive ? ' is-active' : ''}${isActive && isPending ? ' is-loading' : ''}`}
                onClick={() => selectWeek(w)}
              >
                {w.label}
              </button>
            )
          })}
          </div>
        </div>

        {scrollable && (
          <button
            type="button"
            className="desk-weeks-nav"
            onClick={() => scrollRail(1)}
            disabled={!reach.on}
            aria-label="Scroll to later weeks"
          >
            <IconChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Indeterminate, because the wait is a database round trip with no
          progress to report. Present only while switching. */}
      <div className="desk-board__bar" aria-hidden="true">
        <span className="desk-board__bar-fill" />
      </div>

      {days && days.options.length > 0 && (
        <div className="desk-days-bar">
          {/* Scrolls inside itself at phone width, with the same edge fades as
              the week rail, so the page itself never scrolls sideways. */}
          <div className="desk-days-wrap">
            <div className="desk-days" role="tablist" aria-label="Day">
              <button
                type="button"
                role="tab"
                aria-selected={shownDay === null}
                className={`desk-day-pill${shownDay === null ? ' is-active' : ''}`}
                onClick={() => selectDay(null)}
              >
                <span className="desk-day-pill__main">Week</span>
                <span className="desk-day-pill__sub">All days</span>
              </button>
              {days.options.map(d => (
                <button
                  type="button"
                  role="tab"
                  key={d.date}
                  aria-selected={shownDay === d.date}
                  className={`desk-day-pill${shownDay === d.date ? ' is-active' : ''}${d.count === 0 ? ' is-empty' : ''}`}
                  onClick={() => selectDay(d.date)}
                >
                  <span className="desk-day-pill__main">{d.label}</span>
                  <span className="desk-day-pill__sub">
                    {d.sub}
                    <span className="desk-day-pill__count" aria-label={`${d.count} games`}>{d.count}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          {lineFilter && (
            <button
              type="button"
              className={`desk-line-toggle${linesOn ? ' is-on' : ''}`}
              aria-pressed={linesOn}
              onClick={toggleLines}
            >
              <span className="desk-line-toggle__box" aria-hidden="true" />
              Has a line
            </button>
          )}
        </div>
      )}

      <div className={`dk-layout${aside ? ' has-rail' : ''}`}>
      <div className="dk-main">
      {band}

      {games.length > 0 && (
        <div className="desk-summary">
          {summary.map(s => (
            <div className="desk-summary__cell" key={s.label}>
              <span className={`desk-summary__value${s.accent ? ' is-accent' : ''}`}>{s.value}</span>
              <span className="desk-summary__label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {lineFilter && lineFilter.on && lineFilter.hidden > 0 && (
        <p className="desk-quiet">
          Showing the {games.length} priced game{games.length === 1 ? '' : 's'}, plus {lineFilter.hidden} more without a posted line.{' '}
          <button type="button" className="desk-quiet__link" onClick={toggleLines}>Show all</button>
        </p>
      )}

      {games.length > 0 && !anyResearch && (
        // Never a "nothing here" line (Ed, Nov 2026): say what IS on the board
        // and point at the next matchup page, which is open to everyone.
        <p className="desk-quiet dk-lead">
          {games.length} {games.length === 1 ? 'game' : 'games'} {days?.active ? dayPhrase(activeDayLabel) : 'this week'}, lines and matchup pages inside.
          {nextGame && (
            <>
              {' '}Up next:{' '}
              <Link href={gamePath(sport, nextGame.slug)} className="dk-lead__link">
                {nextGame.away_abbrev} @ {nextGame.home_abbrev}
                {nextGame.kickoff && <span className="dk-lead__when">, {kickoffDisplay(nextGame.kickoff, nextGame.kickoff_tbd)}</span>}
              </Link>
            </>
          )}
        </p>
      )}

      {slate.length === 0 && (
        <div className="desk-empty dk-empty">
          {lineFilter?.on && lineFilter.hidden > 0 ? (
            <>
              {lineFilter.hidden} {lineFilter.hidden === 1 ? 'game is' : 'games are'} on the board, waiting on a posted line.{' '}
              <button type="button" className="desk-quiet__link" onClick={toggleLines}>Show all games</button>
            </>
          ) : days?.active ? (
            nextDay ? (
              <>
                The slate picks up {dayPhrase(nextDay.label, nextDay.sub)} with {nextDay.count} {nextDay.count === 1 ? 'game' : 'games'}.{' '}
                <button type="button" className="desk-quiet__link" onClick={() => selectDay(nextDay.date)}>Go to {nextDay.label}</button>
                {' · '}
                <button type="button" className="desk-quiet__link" onClick={() => selectDay(null)}>Whole week</button>
              </>
            ) : (
              <>
                An off night on the schedule.{' '}
                <button type="button" className="desk-quiet__link" onClick={() => selectDay(null)}>See the whole week</button>
              </>
            )
          ) : (
            "This week's schedule is on its way. Pick another week above to browse the board."
          )}
        </div>
      )}

      {slate.map(day => (
        <section className={`desk-day${day.done ? ' is-done' : ''}`} key={day.label}>
          {/* The marker earns its place by explaining the order: a finished day
              sits below an unfinished one, which only reads as deliberate if
              the header says the day is over.

              h2, not h3: the page goes h1 (league) straight to these, and a
              skipped level breaks heading navigation for screen readers. */}
          <h2 className="desk-day__label">
            {day.label}
            <span className="desk-day__count">{day.games.length}</span>
            {day.games.some(g => g.status === 'in') && (
              <span className="desk-day__live">
                <span className="desk-card__pulse" />
                Live
              </span>
            )}
            {day.done && <span className="desk-day__done">Final</span>}
          </h2>

          <div className="desk-day__grid">
            {day.games.map(g => {
              const counts = linkedCounts[g.id] ?? { systems: 0, trends: 0 }
              const attached = counts.systems + counts.trends
              const betsHere = betCounts[g.id] ?? 0
              const spread = spreadLabel(g.spread_current, g.home_abbrev, g.away_abbrev)
              const move = lineMove(g.spread_open, g.spread_current)
              const totalMove = lineMove(g.total_open, g.total_current)
              // The live feed wins while it has the game; the stored row otherwise.
              const lg = liveById.get(g.id)
              const state = lg?.state ?? g.status
              const awayScore = lg && lg.state !== 'pre' ? lg.away.score : g.away_score
              const homeScore = lg && lg.state !== 'pre' ? lg.home.score : g.home_score
              const final = state === 'post'
              const live = state === 'in'
              const status = live && lg?.detail ? lg.detail : STATUS_LABEL[state] ?? ''
              const unlocked = hasDesk || isAdmin
              // Graded against the closing line; both null until final and priced.
              const ats = atsTag(g)
              const ou = ouTag(g)

              // Home-relative spread: negative means the home side is laying it.
              const homeFav = g.spread_current !== null && g.spread_current !== undefined && g.spread_current < 0
              const awayFav = g.spread_current !== null && g.spread_current !== undefined && g.spread_current > 0

              const sides = [
                {
                  key: 'away',
                  abbrev: g.away_abbrev,
                  team: g.away_team,
                  record: g.away_record,
                  score: awayScore,
                  fav: awayFav,
                  poss: lg?.possession === 'away',
                },
                {
                  key: 'home',
                  abbrev: g.home_abbrev,
                  team: g.home_team,
                  record: g.home_record,
                  score: homeScore,
                  fav: homeFav,
                  poss: lg?.possession === 'home',
                },
              ]
              const winner = final && homeScore != null && awayScore != null
                ? (homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : null)
                : null

              return (
                <Link
                  key={g.id}
                  href={gamePath(sport, g.slug)}
                  className={`desk-card${final ? ' desk-card--final' : ''}${live ? ' desk-card--live' : ''}`}
                >
                  <div className="desk-card__top">
                    <span className="desk-card__time">{kickoffDisplay(g.kickoff, g.kickoff_tbd)}</span>
                    {status && (
                      <span className="desk-card__status">
                        {live && <span className="desk-card__pulse" aria-hidden="true" />}
                        {status}
                      </span>
                    )}
                    {g.broadcast && <span className="desk-card__tv">{g.broadcast}</span>}
                  </div>

                  <div className="desk-card__teams">
                    {sides.map(side => (
                      <div
                        key={side.key}
                        className={`desk-card__side${side.fav ? ' is-fav' : ''}${
                          winner && winner !== side.key ? ' is-beaten' : ''
                        }`}
                      >
                        <span className="desk-card__tile">
                          {/* Logo when the abbreviation resolves (NFL), clean type
                              otherwise. teamLogoUrl returns null rather than a
                              guessed URL, so this never renders a broken image
                              and never needs a client-side onError handler. */}
                          {teamLogoUrl(sport, side.abbrev)
                            ? <img
                                className="desk-card__logo"
                                src={teamLogoUrl(sport, side.abbrev)!}
                                alt=""
                                aria-hidden="true"
                                loading="lazy"
                                decoding="async"
                                width={32}
                                height={32}
                              />
                            : side.abbrev}
                          <span className="sr-only">{side.abbrev}</span>
                        </span>
                        <span className="desk-card__ident">
                          <span className="desk-card__name">{teamName(sport, side.team, side.abbrev)}</span>
                          {side.record && <span className="desk-card__rec">{side.record}</span>}
                        </span>
                        {(final || live) && side.score != null && (
                          <span className={`desk-card__score${live ? ' is-live' : ''}`}>
                            {side.poss && <span className="desk-card__poss" aria-label="has the ball" />}
                            {side.score}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {(ats || ou) && (
                    <div className="ats-tags">
                      {ats && <span className={`ats-tag ats-tag--${ats.side === 'push' ? 'push' : 'cover'}`}>{ats.label}</span>}
                      {ou && <span className={`ats-tag ats-tag--${ou.result}`}>{ou.label}</span>}
                    </div>
                  )}

                  <div className="desk-card__market">
                    <span className="desk-chip">
                      <span className="desk-chip__key">Spread</span>
                      {spread ? (
                        <span className="desk-chip__val">
                          {spread}
                          {move && (
                            <span className={`desk-chip__move desk-chip__move--${move.delta > 0 ? 'up' : 'down'}`}>
                              {move.label}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="desk-chip__val desk-chip__val--none">—</span>
                      )}
                    </span>

                    <span className="desk-chip">
                      <span className="desk-chip__key">Total</span>
                      {g.total_current !== null && g.total_current !== undefined ? (
                        <span className="desk-chip__val">
                          {g.total_current}
                          {totalMove && (
                            <span className={`desk-chip__move desk-chip__move--${totalMove.delta > 0 ? 'up' : 'down'}`}>
                              {totalMove.label}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="desk-chip__val desk-chip__val--none">—</span>
                      )}
                    </span>

                    <span className="desk-chip">
                      <span className="desk-chip__key">{g.home_abbrev} ML</span>
                      <span className={`desk-chip__val${moneylineLabel(g.ml_home_current) ? '' : ' desk-chip__val--none'}`}>
                        {moneylineLabel(g.ml_home_current) ?? '—'}
                      </span>
                    </span>
                  </div>

                  <div className="desk-card__foot">
                    <span className="desk-card__tags">
                      {attached > 0 && (
                        // A closed week outranks the rung. "3 locked" would sell
                        // a Desk membership that does not open it, and "3
                        // attached" would promise a Desk member something they
                        // will not find when they click through.
                        researchClosed ? (
                          <span className="desk-tag desk-tag--closed">
                            <IconLock size={11} /> Research closed
                          </span>
                        ) : unlocked ? (
                          <span className="desk-tag desk-tag--open">{attached} Systems/Trends</span>
                        ) : (
                          <span className="desk-tag desk-tag--locked">
                            <IconLock size={11} /> {attached} Systems/Trends
                          </span>
                        )
                      )}
                      {betsHere > 0 && (
                        // Open for the Desk. Anyone else may still see the free
                        // ones on the game page, but the Portfolio picks among
                        // them are locked, so the tag shows the lock.
                        <span className={`desk-tag ${hasDesk || isAdmin ? 'desk-tag--open' : 'desk-tag--locked'}`}>
                          {!(hasDesk || isAdmin) && <IconLock size={11} />} {betsHere} {betsHere === 1 ? 'Bet' : 'Bets'}
                        </span>
                      )}
                    </span>
                    <span className="desk-card__go" aria-hidden="true">
                      <IconArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}

      {games.length > 0 && games.some(g => g.odds_provider) && (
        <p className="desk-attrib">
          Lines via {games.find(g => g.odds_provider)?.odds_provider}. Odds shown for
          reference only. If gambling stops being fun, call 1-800-GAMBLER.
        </p>
      )}
      </div>
      {aside && <aside className="dk-side" aria-label="Line movers and next up">{aside}</aside>}
      </div>
    </div>
  )
}
