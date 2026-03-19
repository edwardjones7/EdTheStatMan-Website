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
  const maxVal  = data ? Math.max(...data.points.map(p => p.count), 1) : 1
  const n       = data?.points.length ?? 0
  const dense   = n > 15

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
      ) : (
        <div className="analytics-chart-wrap">
          <div className={`analytics-chart${dense ? ' analytics-chart--dense' : ''}`}>
            {data!.points.map((p, i) => {
              const heightPct = (p.count / maxVal) * 100
              return (
                <div
                  key={i}
                  className="analytics-chart__col"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {hovered === i && (
                    <div className="analytics-bar-tooltip">
                      {p.count} view{p.count !== 1 ? 's' : ''}
                    </div>
                  )}
                  <div
                    className="analytics-chart__bar"
                    style={{ height: `${Math.max(heightPct, p.count > 0 ? 3 : 0)}%` }}
                  />
                  <div className="analytics-chart__label analytics-chart__label--show">
                    {p.label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
