'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import type { PublicNflGame } from '@/lib/nfl'
import { spreadLabel, moneylineLabel, lineMove, groupSlate } from '@/lib/nfl'
import { IconLock, IconArrowRight, IconChevronLeft, IconChevronRight } from './Icons'
import { teamLogoUrl } from '@/lib/logos'

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
  /** Whether this member holds the Research Desk rung or better. */
  hasDesk: boolean
  isAdmin: boolean
}

const STATUS_LABEL: Record<string, string> = { pre: '', in: 'LIVE', post: 'FINAL' }

function kickoffDisplay(kickoff: string | null): string {
  if (!kickoff) return 'TBD'
  return new Date(kickoff).toLocaleString('en-US', {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York',
  })
}


/**
 * The city is already carried by the abbreviation tile, so the card leads with
 * the nickname — "Bengals", not "Cincinnati Bengals". Falls back to the whole
 * string for single-word names.
 */
function nickname(team: string): string {
  const parts = team.trim().split(/\s+/)
  return parts.length > 1 ? parts[parts.length - 1] : team
}

export default function DeskWeekBoard({
  sport, games, weeks, active, linkedCounts, hasDesk, isAdmin,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

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
  function selectWeek(w: WeekOption) {
    if (shown && shown.season_type === w.season_type && shown.week === w.week) return
    setRequested({ season_type: w.season_type, week: w.week })
    const params = new URLSearchParams()
    params.set('week', String(w.week))
    if (w.season_type === 3) params.set('type', 'post')
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
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

  const days = groupSlate(games)

  // Week header numbers. These are the honest advertisement for the rung: how
  // much research is actually sitting on this week's board.
  const researched = games.filter(g => {
    const c = linkedCounts[g.id]
    return c && c.systems + c.trends > 0
  }).length
  const writeups = games.filter(g => g.has_writeup).length
  const moved = games.filter(g => lineMove(g.spread_open, g.spread_current)).length
  const summary = [
    { value: games.length, label: games.length === 1 ? 'Game' : 'Games' },
    { value: researched, label: 'With research', accent: researched > 0 },
    { value: writeups, label: writeups === 1 ? 'Write-up' : 'Write-ups', accent: writeups > 0 },
    { value: moved, label: 'Lines moved' },
  ]

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

      {days.length === 0 && (
        <div className="desk-empty">No games scheduled for this week yet.</div>
      )}

      {days.map(day => (
        <section className={`desk-day${day.done ? ' is-done' : ''}`} key={day.label}>
          {/* The marker earns its place by explaining the order: a finished day
              sits below an unfinished one, which only reads as deliberate if
              the header says the day is over. */}
          <h3 className="desk-day__label">
            {day.label}
            <span className="desk-day__count">{day.games.length}</span>
            {day.games.some(g => g.status === 'in') && (
              <span className="desk-day__live">
                <span className="desk-card__pulse" />
                Live
              </span>
            )}
            {day.done && <span className="desk-day__done">Final</span>}
          </h3>

          <div className="desk-day__grid">
            {day.games.map(g => {
              const counts = linkedCounts[g.id] ?? { systems: 0, trends: 0 }
              const attached = counts.systems + counts.trends
              const spread = spreadLabel(g.spread_current, g.home_abbrev, g.away_abbrev)
              const move = lineMove(g.spread_open, g.spread_current)
              const totalMove = lineMove(g.total_open, g.total_current)
              const status = STATUS_LABEL[g.status] ?? ''
              const final = g.status === 'post'
              const live = g.status === 'in'
              const unlocked = hasDesk || isAdmin

              // Home-relative spread: negative means the home side is laying it.
              const homeFav = g.spread_current !== null && g.spread_current !== undefined && g.spread_current < 0
              const awayFav = g.spread_current !== null && g.spread_current !== undefined && g.spread_current > 0

              const sides = [
                {
                  key: 'away',
                  abbrev: g.away_abbrev,
                  team: g.away_team,
                  record: g.away_record,
                  score: g.away_score,
                  fav: awayFav,
                },
                {
                  key: 'home',
                  abbrev: g.home_abbrev,
                  team: g.home_team,
                  record: g.home_record,
                  score: g.home_score,
                  fav: homeFav,
                },
              ]
              const winner = final && g.home_score !== null && g.away_score !== null
                ? (g.home_score > g.away_score ? 'home' : g.away_score > g.home_score ? 'away' : null)
                : null

              return (
                <Link
                  key={g.id}
                  href={`/desk/${sport}/g/${g.slug}`}
                  className={`desk-card${final ? ' desk-card--final' : ''}${live ? ' desk-card--live' : ''}`}
                >
                  <div className="desk-card__top">
                    <span className="desk-card__time">{kickoffDisplay(g.kickoff)}</span>
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
                          <span className="desk-card__name">{nickname(side.team)}</span>
                          {side.record && <span className="desk-card__rec">{side.record}</span>}
                        </span>
                        {final && side.score !== null && (
                          <span className="desk-card__score">{side.score}</span>
                        )}
                      </div>
                    ))}
                  </div>

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
                        unlocked ? (
                          <span className="desk-tag desk-tag--open">{attached} attached</span>
                        ) : (
                          <span className="desk-tag desk-tag--locked">
                            <IconLock size={11} /> {attached} locked
                          </span>
                        )
                      )}
                      {g.has_writeup && (
                        <span className={`desk-tag ${unlocked ? 'desk-tag--open' : 'desk-tag--locked'}`}>
                          {!unlocked && <IconLock size={11} />} Desk note
                        </span>
                      )}
                      {attached === 0 && !g.has_writeup && (
                        <span className="desk-tag desk-tag--empty">No research yet</span>
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
  )
}
