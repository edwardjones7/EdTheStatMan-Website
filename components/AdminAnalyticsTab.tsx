'use client'

import { useEffect, useState } from 'react'

type Range = 'week' | 'month' | 'year'

interface Point        { label: string; count: number }
interface TopPage      { path: string; count: number }
interface ReferrerItem { source: string; count: number }
interface DeviceItem   { device: string; count: number }
interface CountryItem  { country: string; count: number }

interface AnalyticsData {
  totalViews:   number
  viewsInRange: number
  viewsToday:   number
  points:       Point[]
  topPages:     TopPage[]
  referrers:    ReferrerItem[]
  devices:      DeviceItem[]
  countries:    CountryItem[]
  newSignups:   number
  totalUsers:   number
  paidUsers:    number
}

const RANGE_LABELS: Record<Range, string> = {
  week:  'This Week',
  month: 'This Month',
  year:  'This Year',
}

const CHART_TITLES: Record<Range, string> = {
  week:  'Daily Views — Last 7 Days',
  month: 'Daily Views — Last 30 Days',
  year:  'Weekly Views — Last 12 Months',
}

export default function AdminAnalyticsTab() {
  const [range, setRange]     = useState<Range>('month')
  const [data, setData]       = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/admin/analytics?range=${range}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [range])

  const maxBar = data ? Math.max(...data.points.map(p => p.count), 1) : 1
  const totalRangeViews = data?.points.reduce((s, p) => s + p.count, 0) ?? 0

  return (
    <div className="admin-section">

      {/* Range toggle */}
      <div className="admin-filters" style={{ marginBottom: '1.5rem' }}>
        {(['week', 'month', 'year'] as Range[]).map(r => (
          <button
            key={r}
            className={`admin-filter-btn ${range === r ? 'admin-filter-btn--active' : ''}`}
            onClick={() => setRange(r)}
          >
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p className="admin-muted" style={{ padding: '2rem 0' }}>Loading analytics…</p>}
      {!loading && (error || !data) && <p className="admin-muted" style={{ padding: '2rem 0' }}>Failed to load analytics.</p>}

      {!loading && data && (
        <>
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
                <span className="admin-kpi-card__label">{RANGE_LABELS[range]}</span>
              </div>
              <div className="admin-kpi-card__value">{data.viewsInRange.toLocaleString()}</div>
              <div className="admin-kpi-card__sub">page views</div>
              <div className="admin-kpi-card__bar">
                <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--green" style={{ width: `${data.totalViews ? (data.viewsInRange / data.totalViews) * 100 : 0}%` }} />
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
                <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--purple" style={{ width: `${data.viewsInRange ? (data.viewsToday / data.viewsInRange) * 100 : 0}%` }} />
              </div>
            </div>

            <div className="admin-kpi-card">
              <div className="admin-kpi-card__top">
                <span className="admin-kpi-card__label">Top Page</span>
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

          {/* Bar chart */}
          <div className="admin-breakdown-card" style={{ marginBottom: '1.5rem' }}>
            <h3 className="admin-breakdown-card__title">
              {CHART_TITLES[range]}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.75rem' }}>
                {totalRangeViews.toLocaleString()} total
              </span>
            </h3>
            <div className="analytics-chart-wrap">
              <div className="analytics-chart">
                {data.points.map((p, i) => {
                  const heightPct = maxBar > 0 ? (p.count / maxBar) * 100 : 0
                  const n = data.points.length
                  const showLabel = i === 0 || i === Math.floor(n / 2) || i === n - 1 || p.count === Math.max(...data.points.map(x => x.count))
                  return (
                    <div key={i} className="analytics-chart__col" title={`${p.label}: ${p.count} view${p.count !== 1 ? 's' : ''}`}>
                      <div
                        className="analytics-chart__bar"
                        style={{ height: `${Math.max(heightPct, p.count > 0 ? 3 : 0)}%` }}
                      />
                      <div className={`analytics-chart__label ${showLabel ? 'analytics-chart__label--show' : ''}`}>
                        {p.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Top pages */}
          {data.topPages.length > 0 ? (
            <div className="admin-breakdown-card" style={{ marginBottom: '1.5rem' }}>
              <h3 className="admin-breakdown-card__title">Top Pages — {RANGE_LABELS[range]}</h3>
              <div className="admin-breakdown-list">
                {data.topPages.map(p => (
                  <BreakdownRow
                    key={p.path}
                    label={p.path}
                    value={p.count}
                    total={totalRangeViews}
                    color="var(--accent-cyan)"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="admin-breakdown-card" style={{ marginBottom: '1.5rem' }}>
              <p className="admin-muted" style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                No page views recorded yet.
              </p>
            </div>
          )}

          {/* Conversion funnel */}
          <div className="admin-kpi-row" style={{ marginBottom: '1.5rem' }}>
            <div className="admin-kpi-card">
              <div className="admin-kpi-card__top">
                <span className="admin-kpi-card__label">New Signups</span>
                <span className="admin-kpi-card__badge admin-kpi-card__badge--green">{RANGE_LABELS[range]}</span>
              </div>
              <div className="admin-kpi-card__value">{data.newSignups.toLocaleString()}</div>
              <div className="admin-kpi-card__sub">new accounts created</div>
              <div className="admin-kpi-card__bar">
                <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--green" style={{ width: data.totalUsers ? `${(data.newSignups / data.totalUsers) * 100}%` : '0%' }} />
              </div>
            </div>
            <div className="admin-kpi-card">
              <div className="admin-kpi-card__top">
                <span className="admin-kpi-card__label">Paid Conversion</span>
              </div>
              <div className="admin-kpi-card__value">
                {data.totalUsers ? `${((data.paidUsers / data.totalUsers) * 100).toFixed(1)}%` : '—'}
              </div>
              <div className="admin-kpi-card__sub">{data.paidUsers} of {data.totalUsers} users</div>
              <div className="admin-kpi-card__bar">
                <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--purple" style={{ width: data.totalUsers ? `${(data.paidUsers / data.totalUsers) * 100}%` : '0%' }} />
              </div>
            </div>
          </div>

          {/* Traffic sources + Devices side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>

            {/* Referrer sources */}
            <div className="admin-breakdown-card">
              <h3 className="admin-breakdown-card__title">Traffic Sources — {RANGE_LABELS[range]}</h3>
              {data.referrers.length > 0 ? (
                <div className="admin-breakdown-list">
                  {data.referrers.map(r => (
                    <BreakdownRow
                      key={r.source}
                      label={r.source}
                      value={r.count}
                      total={totalRangeViews}
                      color="var(--accent-green)"
                    />
                  ))}
                </div>
              ) : (
                <p className="admin-muted" style={{ padding: '1rem 0', fontSize: '0.85rem' }}>No referrer data yet.</p>
              )}
            </div>

            {/* Devices */}
            <div className="admin-breakdown-card">
              <h3 className="admin-breakdown-card__title">Devices — {RANGE_LABELS[range]}</h3>
              {data.devices.length > 0 ? (
                <div className="admin-breakdown-list">
                  {data.devices.map(d => (
                    <BreakdownRow
                      key={d.device}
                      label={d.device.charAt(0).toUpperCase() + d.device.slice(1)}
                      value={d.count}
                      total={totalRangeViews}
                      color={d.device === 'mobile' ? 'var(--accent-cyan)' : d.device === 'tablet' ? 'var(--accent-gold)' : 'var(--accent-purple)'}
                    />
                  ))}
                </div>
              ) : (
                <p className="admin-muted" style={{ padding: '1rem 0', fontSize: '0.85rem' }}>No device data yet.</p>
              )}
            </div>
          </div>

          {/* Countries */}
          {data.countries.length > 0 && (
            <div className="admin-breakdown-card">
              <h3 className="admin-breakdown-card__title">Countries — {RANGE_LABELS[range]}</h3>
              <div className="admin-breakdown-list">
                {data.countries.map(c => (
                  <BreakdownRow
                    key={c.country}
                    label={c.country}
                    value={c.count}
                    total={totalRangeViews}
                    color="var(--accent-gold)"
                  />
                ))}
              </div>
            </div>
          )}
        </>
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
