import type { TodaysBet } from './TodaysBets'

interface CalcStats {
  wins: number
  losses: number
  pushes: number
  winPct: number
}

/** One team's graded record. Built server-side; see app/portfolio/page.tsx. */
export interface TeamRecord {
  team: string
  sport: string
  wins: number
  losses: number
  pushes: number
}

interface Props {
  calcStats: CalcStats
  picks?: TodaysBet[]
  /** Per-team split of the same picks, rendered inside this section. */
  breakdown?: TeamRecord[]
  /** Sample floor the breakdown was filtered at, quoted in the footnote. */
  breakdownMin?: number
}

// Current overall streak of wins or losses (pushes don't break it). picks newest-first.
function currentStreak(picks: TodaysBet[]): { type: 'win' | 'loss' | null; count: number } {
  let type: 'win' | 'loss' | null = null
  let count = 0
  for (const p of picks) {
    if (p.result === 'push') continue
    if (p.result !== 'win' && p.result !== 'loss') continue
    if (type === null) { type = p.result; count = 1 }
    else if (p.result === type) count++
    else break
  }
  return { type, count }
}

// Overall model record — win rate, W-L-P, ratio bar, legend. Rendered on the
// results page beneath the Pick Results chart.
export default function ModelPerformance({ calcStats, picks = [], breakdown = [], breakdownMin = 0 }: Props) {
  const total = calcStats.wins + calcStats.losses + calcStats.pushes
  const seg = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  const streak = currentStreak(picks)

  return (
    <section className="section">
      <div className="container">
        <div className="reveal" style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span className="section-label">Live Track Record</span>
          <h2 className="section-title" style={{ fontSize: '1.8rem', marginBottom: '0' }}>Model Performance</h2>
        </div>

        <div className="perf reveal-scale">
          <div className="perf-hero">
            <div
              className="perf-hero__pct-value"
              data-count={calcStats.winPct.toFixed(1)}
              data-suffix="%"
              data-decimals="1"
              dangerouslySetInnerHTML={{ __html: `${calcStats.winPct.toFixed(1)}%` }}
            />
            <div className="perf-hero__pct-label">Win Rate</div>

            <div className="perf-hero__record">{calcStats.wins}&#8202;-&#8202;{calcStats.losses}&#8202;-&#8202;{calcStats.pushes}</div>
            <div className="perf-hero__sub">
              <span>{total} graded {total === 1 ? 'pick' : 'picks'}</span>
              {streak.type && streak.count > 1 && (
                <span
                  className={`perf-streak perf-streak--${streak.type}`}
                  title={`Current ${streak.type} streak`}
                >
                  {streak.count}{streak.type === 'win' ? 'W' : 'L'} streak
                </span>
              )}
            </div>

            <div
              className="perf-ratio"
              role="img"
              aria-label={`${calcStats.wins} wins, ${calcStats.losses} losses, ${calcStats.pushes} pushes`}
            >
              <div className="perf-ratio__seg perf-ratio__seg--w" data-width={seg(calcStats.wins).toFixed(2)} />
              <div className="perf-ratio__seg perf-ratio__seg--l" data-width={seg(calcStats.losses).toFixed(2)} />
              <div className="perf-ratio__seg perf-ratio__seg--p" data-width={seg(calcStats.pushes).toFixed(2)} />
            </div>

            <div className="perf-legend">
              <span className="perf-legend__item"><span className="perf-legend__dot" style={{ background: '#2dd4bf' }} />Wins <span className="perf-legend__num">{calcStats.wins}</span></span>
              <span className="perf-legend__item"><span className="perf-legend__dot" style={{ background: '#f8717a' }} />Losses <span className="perf-legend__num">{calcStats.losses}</span></span>
              <span className="perf-legend__item"><span className="perf-legend__dot" style={{ background: '#e9c46a' }} />Pushes <span className="perf-legend__num">{calcStats.pushes}</span></span>
            </div>
          </div>
        </div>

        {breakdown.length > 0 && (
          <div className="perf-teams reveal">
            <div className="perf-teams__head">
              <h3 className="perf-teams__title">By Team</h3>
              <span className="perf-teams__note">
                {breakdownMin > 1
                  ? `Teams with ${breakdownMin}+ graded picks`
                  : 'Every team picked'}
              </span>
            </div>
            <div className="perf-teams__grid">
              {breakdown.map(t => {
                const decided = t.wins + t.losses
                const pct = decided > 0 ? (t.wins / decided) * 100 : 0
                // Coloured against the -110 break-even, not 50%. A 51% team is
                // losing money, and showing it in the same green as a 70% team
                // would be the chart lying politely.
                const tone = pct >= 52.4 ? 'up' : pct >= 50 ? 'even' : 'down'
                return (
                  <div key={t.team + t.sport} className={`perf-team perf-team--${tone}`}>
                    <div className="perf-team__top">
                      <span className="perf-team__name">{t.team}</span>
                      <span className="perf-team__sport">{t.sport}</span>
                    </div>
                    <div className="perf-team__pct">{pct.toFixed(0)}%</div>
                    <div className="perf-team__record">
                      {t.wins}&#8202;-&#8202;{t.losses}{t.pushes > 0 ? ` - ${t.pushes}` : ''}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
