'use client'

import { useEffect, useState } from 'react'

type Range = 'week' | 'month' | 'year'

interface Point {
  label: string
  count: number
}

interface AnalyticsData {
  totalViews:   number
  viewsInRange: number
  viewsToday:   number
  points:       Point[]
}

const W = 900
const H = 180
const PAD = { top: 16, right: 24, bottom: 40, left: 44 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

const RANGE_STAT_LABELS: Record<Range, string> = {
  week:  'this week',
  month: 'this month',
  year:  'this year',
}

const CHART_TITLES: Record<Range, string> = {
  week:  'Page Views — Last 7 Days',
  month: 'Page Views — Last 30 Days',
  year:  'Page Views — Last 12 Months',
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`
  }
  return d
}

export default function AdminLineChart() {
  const [range, setRange]     = useState<Range>('month')
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    setHovered(null)
    fetch(`/api/admin/analytics?range=${range}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range])

  const isEmpty = !data || data.points.length === 0

  return (
    <div className="admin-line-chart-wrap">
      <div className="admin-line-chart-header">
        <span className="admin-line-chart-title">{CHART_TITLES[range]}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          {!loading && data && (
            <div className="admin-line-chart-stats">
              <span><strong>{data.viewsToday.toLocaleString()}</strong> today</span>
              <span><strong>{data.viewsInRange.toLocaleString()}</strong> {RANGE_STAT_LABELS[range]}</span>
              <span><strong>{data.totalViews.toLocaleString()}</strong> all time</span>
            </div>
          )}
          <div className="admin-filters" style={{ margin: 0 }}>
            {(['week', 'month', 'year'] as Range[]).map(r => (
              <button
                key={r}
                className={`admin-filter-btn ${range === r ? 'admin-filter-btn--active' : ''}`}
                onClick={() => setRange(r)}
                style={{ padding: '2px 10px', fontSize: '0.75rem' }}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {(loading || isEmpty) ? (
        <div className="admin-line-chart-loading">{loading ? 'Loading…' : 'No data yet.'}</div>
      ) : (() => {
        const points = data!.points
        const counts = points.map(p => p.count)
        const maxVal = Math.max(...counts, 1)
        const n = points.length

        const svgPoints = points.map((p, i) => ({
          x: PAD.left + (i / (n - 1)) * INNER_W,
          y: PAD.top + INNER_H - (p.count / maxVal) * INNER_H,
        }))

        const linePath = smoothPath(svgPoints)
        const areaPath = linePath
          + ` L ${svgPoints[n - 1].x} ${PAD.top + INNER_H}`
          + ` L ${svgPoints[0].x} ${PAD.top + INNER_H} Z`

        const yTicks = [0, 0.25, 0.5, 0.75, 1].map(frac => ({
          y: PAD.top + INNER_H - frac * INNER_H,
          label: Math.round(frac * maxVal),
        }))

        // Show ~5 evenly spaced x labels
        const xStep = Math.max(1, Math.floor(n / 5))
        const xLabels = points.map((p, i) => ({
          x: PAD.left + (i / (n - 1)) * INNER_W,
          label: p.label,
          show: i === 0 || i === n - 1 || i % xStep === 0,
        }))

        const hov   = hovered !== null ? points[hovered] : null
        const hovPt = hovered !== null ? svgPoints[hovered] : null

        return (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="admin-line-chart-svg"
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#34d399" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {yTicks.map(t => (
              <g key={t.y}>
                <line x1={PAD.left} y1={t.y} x2={PAD.left + INNER_W} y2={t.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize="10" fill="rgba(161,161,170,0.7)">{t.label}</text>
              </g>
            ))}

            <path d={areaPath} fill="url(#chartFill)" />
            <path d={linePath} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />

            {xLabels.filter(l => l.show).map((l, i) => (
              <text key={i} x={l.x} y={H - 6} textAnchor="middle" fontSize="10" fill="rgba(161,161,170,0.7)">{l.label}</text>
            ))}

            {points.map((_, i) => (
              <rect
                key={i}
                x={svgPoints[i].x - INNER_W / n / 2}
                y={PAD.top}
                width={INNER_W / n}
                height={INNER_H}
                fill="transparent"
                onMouseEnter={() => setHovered(i)}
              />
            ))}

            {hovered !== null && hovPt && (
              <>
                <line x1={hovPt.x} y1={PAD.top} x2={hovPt.x} y2={PAD.top + INNER_H} stroke="rgba(52,211,153,0.3)" strokeWidth="1" strokeDasharray="3 3" />
                <circle cx={hovPt.x} cy={hovPt.y} r="4" fill="#34d399" />
                <g>
                  <rect
                    x={Math.min(hovPt.x - 44, W - 96)} y={hovPt.y - 34}
                    width={88} height={26} rx="5"
                    fill="#1a1a1e" stroke="rgba(52,211,153,0.3)" strokeWidth="1"
                  />
                  <text
                    x={Math.min(hovPt.x - 44, W - 96) + 44} y={hovPt.y - 16}
                    textAnchor="middle" fontSize="10" fill="#e4e4e7"
                  >
                    {hov!.label}{' · '}{hov!.count} view{hov!.count !== 1 ? 's' : ''}
                  </text>
                </g>
              </>
            )}
          </svg>
        )
      })()}
    </div>
  )
}
