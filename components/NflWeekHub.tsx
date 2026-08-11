'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import type { PublicNflGame } from '@/lib/nfl'
import { IconLock } from './Icons'

interface WeekOption {
  season_type: number
  week: number
  label: string
}

interface Props {
  games: PublicNflGame[]
  weeks: WeekOption[]
  active: { season_type: number; week: number } | null
  linkedCounts: Record<string, { systems: number; trends: number }>
  hasElite: boolean
  isAdmin: boolean
}

const STATUS_LABEL: Record<string, string> = { pre: 'Upcoming', in: 'Live', post: 'Final' }

function kickoffDisplay(kickoff: string | null): string {
  if (!kickoff) return 'TBD'
  return new Date(kickoff).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short',
  })
}

export default function NflWeekHub({ games, weeks, active, linkedCounts, hasElite, isAdmin }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  // Selected week lives in the URL so it survives refresh/share, same pattern
  // as the sport tabs on the systems page.
  function selectWeek(w: WeekOption) {
    const params = new URLSearchParams()
    params.set('week', String(w.week))
    if (w.season_type === 3) params.set('type', 'post')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <>
      <div className="nfl-week-pills reveal">
        {weeks.map(w => {
          const isActive = active && w.season_type === active.season_type && w.week === active.week
          return (
            <button
              key={`${w.season_type}-${w.week}`}
              className={`nfl-week-pill${isActive ? ' active' : ''}${w.season_type === 3 ? ' nfl-week-pill--post' : ''}`}
              onClick={() => selectWeek(w)}
            >
              {w.season_type === 3 ? w.label : `Wk ${w.week}`}
            </button>
          )
        })}
      </div>

      {games.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          No games scheduled for this week yet.
        </div>
      ) : (
        <div className="nfl-game-grid">
          {games.map(game => {
            const counts = linkedCounts[game.id] ?? { systems: 0, trends: 0 }
            const totalLinks = counts.systems + counts.trends
            const showScore = game.status !== 'pre' && game.home_score !== null && game.away_score !== null
            return (
              <Link key={game.id} href={`/nfl/games/${game.slug}`} className="nfl-game-card">
                {isAdmin && !game.is_published && (
                  <span className="nfl-game-card__draft">Draft</span>
                )}
                <div className="nfl-game-card__meta">
                  <span>{kickoffDisplay(game.kickoff)}</span>
                  <span className={`nfl-game-card__status nfl-game-card__status--${game.status}`}>
                    {STATUS_LABEL[game.status] ?? game.status}
                  </span>
                </div>

                <div className="nfl-game-card__matchup">
                  <div className="nfl-game-card__team">
                    <span className="nfl-game-card__abbrev">{game.away_abbrev}</span>
                    <span className="nfl-game-card__name">{game.away_team}</span>
                    {showScore && <span className="nfl-game-card__score">{game.away_score}</span>}
                  </div>
                  <span className="nfl-game-card__at">at</span>
                  <div className="nfl-game-card__team">
                    <span className="nfl-game-card__abbrev">{game.home_abbrev}</span>
                    <span className="nfl-game-card__name">{game.home_team}</span>
                    {showScore && <span className="nfl-game-card__score">{game.home_score}</span>}
                  </div>
                </div>

                {game.brief && <p className="nfl-game-card__brief">{game.brief}</p>}

                <div className="nfl-game-card__footer">
                  {totalLinks > 0 && (
                    <span className="nfl-game-card__links">
                      {counts.systems > 0 && `${counts.systems} system${counts.systems !== 1 ? 's' : ''}`}
                      {counts.systems > 0 && counts.trends > 0 && ' · '}
                      {counts.trends > 0 && `${counts.trends} trend${counts.trends !== 1 ? 's' : ''}`}
                    </span>
                  )}
                  {game.has_writeup && (
                    hasElite ? (
                      <span className="nfl-game-card__chip nfl-game-card__chip--open">Full breakdown →</span>
                    ) : (
                      <span className="nfl-game-card__chip nfl-game-card__chip--locked">
                        <IconLock size={11} /> Elite analysis
                      </span>
                    )
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
