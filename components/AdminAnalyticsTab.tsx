'use client'

import { useEffect, useState } from 'react'

interface DailyView { date: string; count: number }
interface TopPage   { path: string; count: number }

interface AnalyticsData {
  totalViews:     number
  viewsThisMonth: number
  viewsToday:     number
  daily:          DailyView[]
  topPages:       TopPage[]
}

export default function AdminAnalyticsTab() {
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    fetch('/api/admin/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) return <div className="admin-section"><p className="admin-muted" style={{ padding: '2rem 0' }}>Loading analytics…</p></div>
  if (error || !data) return <div className="admin-section"><p className="admin-muted" style={{ padding: '2rem 0' }}>Failed to load analytics.</p></div>

  const maxDaily = Math.max(...data.daily.map(d => d.count), 1)
  const totalMonthViews = data.daily.reduce((s, d) => s + d.count, 0)

  return (
    <div className="admin-section">

      {/* KPI row */}
      <div className="admin-kpi-row" style={{ marginBottom: '1.5rem' }}>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card__top">
            <span className="admin-kpi-card__label">Total Views</span>
          </div>
          <div className="admin-kpi-card__value">{data.totalViews.toLocaleString()}</div>
          <div className="admin-kpi-card__sub">all time</div>
          <div className="admin-kpi-card__bar">
            <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--cyan" style={{ width: '100%' }} />
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-card__top">
            <span className="admin-kpi-card__label">This Month</span>
          </div>
          <div className="admin-kpi-card__value">{data.viewsThisMonth.toLocaleString()}</div>
          <div className="admin-kpi-card__sub">page views</div>
          <div className="admin-kpi-card__bar">
            <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--green" style={{ width: `${data.totalViews ? (data.viewsThisMonth / data.totalViews) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-card__top">
            <span className="admin-kpi-card__label">Today</span>
            {data.viewsToday > 0 && (
              <span className="admin-kpi-card__badge admin-kpi-card__badge--green">{data.viewsToday} views</span>
            )}
          </div>
          <div className="admin-kpi-card__value">{data.viewsToday.toLocaleString()}</div>
          <div className="admin-kpi-card__sub">page views</div>
          <div className="admin-kpi-card__bar">
            <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--purple" style={{ width: `${data.viewsThisMonth ? (data.viewsToday / data.viewsThisMonth) * 100 : 0}%` }} />
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-card__top">
            <span className="admin-kpi-card__label">Top Page (30d)</span>
          </div>
          <div className="admin-kpi-card__value" style={{ fontSize: '1.1rem', wordBreak: 'break-all' }}>
            {data.topPages[0]?.path ?? '—'}
          </div>
          <div className="admin-kpi-card__sub">{data.topPages[0]?.count ?? 0} views</div>
          <div className="admin-kpi-card__bar">
            <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--gold" style={{ width: data.topPages[0] ? '100%' : '0%' }} />
          </div>
        </div>
      </div>

      {/* Daily bar chart */}
      <div className="admin-breakdown-card" style={{ marginBottom: '1.5rem' }}>
        <h3 className="admin-breakdown-card__title">
          Daily Views — Last 30 Days
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.75rem' }}>
            {totalMonthViews.toLocaleString()} total
          </span>
        </h3>
        <div className="analytics-chart-wrap">
          <div className="analytics-chart">
            {data.daily.map((d, i) => {
              const heightPct = maxDaily > 0 ? (d.count / maxDaily) * 100 : 0
              const showLabel = i === 0 || i === 14 || i === 29 || d.count === maxDaily
              const label = new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return (
                <div key={d.date} className="analytics-chart__col" title={`${label}: ${d.count} view${d.count !== 1 ? 's' : ''}`}>
                  <div
                    className="analytics-chart__bar"
                    style={{ height: `${Math.max(heightPct, d.count > 0 ? 3 : 0)}%` }}
                  />
                  <div className={`analytics-chart__label ${showLabel ? 'analytics-chart__label--show' : ''}`}>
                    {label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Top pages */}
      {data.topPages.length > 0 && (
        <div className="admin-breakdown-card">
          <h3 className="admin-breakdown-card__title">Top Pages — Last 30 Days</h3>
          <div className="admin-breakdown-list">
            {data.topPages.map(p => (
              <BreakdownRow
                key={p.path}
                label={p.path}
                value={p.count}
                total={totalMonthViews}
                color="var(--accent-cyan)"
              />
            ))}
          </div>
        </div>
      )}

      {data.topPages.length === 0 && (
        <div className="admin-breakdown-card">
          <p className="admin-muted" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            No page views recorded yet. Views will appear once the tracker is live.
          </p>
        </div>
      )}
    </div>
  )
}

function BreakdownRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="admin-breakdown-row">
      <div className="admin-breakdown-row__left">
        <span className="admin-breakdown-row__dot" style={{ background: color }} />
        <span className="admin-breakdown-row__label" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{label}</span>
      </div>
      <div className="admin-breakdown-row__right">
        <div className="admin-breakdown-row__bar-track">
          <div className="admin-breakdown-row__bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="admin-breakdown-row__value">{value}</span>
        <span className="admin-breakdown-row__pct">{pct}%</span>
      </div>
    </div>
  )
}
