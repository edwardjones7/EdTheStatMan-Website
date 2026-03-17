'use client'

import { useEffect, useState } from 'react'

interface DailyView { date: string; count: number }

interface AnalyticsData {
  totalViews:     number
  viewsThisMonth: number
  viewsToday:     number
  daily:          DailyView[]
}

const W = 900
const H = 180
const PAD = { top: 16, right: 24, bottom: 40, left: 44 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

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
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="admin-line-chart-wrap">
        <div className="admin-line-chart-header">
          <span className="admin-line-chart-title">Page Views — Last 30 Days</span>
        </div>
        <div className="admin-line-chart-loading">Loading…</div>
      </div>
    )
  }

  if (!data || data.daily.length === 0) {
    return (
      <div className="admin-line-chart-wrap">
        <div className="admin-line-chart-header">
          <span className="admin-line-chart-title">Page Views — Last 30 Days</span>
        </div>
        <div className="admin-line-chart-loading">No data yet.</div>
      </div>
    )
  }

  const counts  = data.daily.map(d => d.count)
  const maxVal  = Math.max(...counts, 1)
  const n       = data.daily.length

  const points = data.daily.map((d, i) => ({
    x: PAD.left + (i / (n - 1)) * INNER_W,
    y: PAD.top + INNER_H - (d.count / maxVal) * INNER_H,
  }))

  const linePath = smoothPath(points)

  // Area path: line + close to bottom
  const areaPath = linePath
    + ` L ${points[points.length - 1].x} ${PAD.top + INNER_H}`
    + ` L ${points[0].x} ${PAD.top + INNER_H} Z`

  // Y-axis grid lines (4 levels)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(frac => ({
    y: PAD.top + INNER_H - frac * INNER_H,
    label: Math.round(frac * maxVal),
  }))

  // X-axis labels: show first, ~every 7th, and last
  const xLabels = data.daily.map((d, i) => {
    const show = i === 0 || i === 6 || i === 13 || i === 20 || i === n - 1
    const label = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { x: PAD.left + (i / (n - 1)) * INNER_W, label, show }
  })

  const hov = hovered !== null ? data.daily[hovered] : null
  const hovPt = hovered !== null ? points[hovered] : null

  return (
    <div className="admin-line-chart-wrap">
      <div className="admin-line-chart-header">
        <span className="admin-line-chart-title">Page Views — Last 30 Days</span>
        <div className="admin-line-chart-stats">
          <span><strong>{data.viewsToday.toLocaleString()}</strong> today</span>
          <span><strong>{data.viewsThisMonth.toLocaleString()}</strong> this month</span>
          <span><strong>{data.totalViews.toLocaleString()}</strong> all time</span>
        </div>
      </div>

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

        {/* Grid lines */}
        {yTicks.map(t => (
          <g key={t.y}>
            <line
              x1={PAD.left} y1={t.y} x2={PAD.left + INNER_W} y2={t.y}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1"
            />
            <text
              x={PAD.left - 6} y={t.y + 4}
              textAnchor="end" fontSize="10" fill="rgba(161,161,170,0.7)"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#chartFill)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#34d399" strokeWidth="2" strokeLinejoin="round" />

        {/* X-axis labels */}
        {xLabels.filter(l => l.show).map(l => (
          <text
            key={l.label}
            x={l.x} y={H - 6}
            textAnchor="middle" fontSize="10" fill="rgba(161,161,170,0.7)"
          >
            {l.label}
          </text>
        ))}

        {/* Hover hit areas */}
        {data.daily.map((d, i) => (
          <rect
            key={i}
            x={points[i].x - INNER_W / n / 2}
            y={PAD.top}
            width={INNER_W / n}
            height={INNER_H}
            fill="transparent"
            onMouseEnter={() => setHovered(i)}
          />
        ))}

        {/* Hover indicator */}
        {hovered !== null && hovPt && (
          <>
            <line
              x1={hovPt.x} y1={PAD.top} x2={hovPt.x} y2={PAD.top + INNER_H}
              stroke="rgba(52,211,153,0.3)" strokeWidth="1" strokeDasharray="3 3"
            />
            <circle cx={hovPt.x} cy={hovPt.y} r="4" fill="#34d399" />
            {/* Tooltip */}
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
                {new Date(hov!.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' · '}
                {hov!.count} view{hov!.count !== 1 ? 's' : ''}
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  )
}
