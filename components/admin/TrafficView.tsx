'use client'

import type { AnalyticsData } from './types'
import { BreakdownRow, Empty, fmtDuration, Kpi, Panel } from './ui'

/** Who visits, from where, and what they read. Signups and sales by source live on Funnel. */
export default function TrafficView({ analytics, loading }: { analytics: AnalyticsData; loading: boolean }) {
  const { failed } = analytics
  const views = analytics.viewsInRange
  const viewsFailed = failed.includes('views')
  const perVisit = analytics.sessions > 0 ? (views / analytics.sessions).toFixed(1) : '—'

  return (
    <>
      <div className="adm-kpis" aria-busy={loading}>
        <Kpi
          label="Page views"
          value={viewsFailed ? '—' : views.toLocaleString()}
          sub={`${analytics.totalViews.toLocaleString()} all time`}
          source="Our tracker · bots filtered by user agent"
        />
        <Kpi
          label="Visitors"
          value={viewsFailed ? '—' : analytics.uniqueVisitors.toLocaleString()}
          source="Ids reset daily: a person on 3 days counts 3 times"
        />
        <Kpi
          label="Visits"
          value={analytics.sessions.toLocaleString()}
          sub={`${perVisit} pages per visit`}
          source="New visit after 30 min idle"
        />
        <Kpi
          label="Single-page visits"
          value={`${Math.round(analytics.bounceRate * 100)}%`}
          source="Left after one page"
        />
        <Kpi
          label="Average visit"
          value={fmtDuration(analytics.avgSessionSecs)}
          source="Visits of 2+ pages, first to last view"
        />
      </div>

      <div className="adm-grid-2">
        <Panel title="Top pages">
          {failed.includes('pages') ? <Empty>Couldn&rsquo;t load pages.</Empty>
            : analytics.topPages.length === 0 ? <Empty>No data yet.</Empty> : (
              <div className="admin-breakdown-list">
                {analytics.topPages.map(p => (
                  <BreakdownRow key={p.path} label={p.path} value={p.count} total={views} mono />
                ))}
              </div>
            )}
        </Panel>
        <Panel title="Referrers" note="The site that sent each view. Blank referrers count as direct.">
          {analytics.referrers.length === 0 ? <Empty>No referrer data yet.</Empty> : (
            <div className="admin-breakdown-list">
              {analytics.referrers.map(r => (
                <BreakdownRow key={r.source} label={r.source} value={r.count} total={views} mono />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="adm-grid-3">
        <Panel title="Campaigns" note="Visits with a utm_source tag on the link.">
          {analytics.utmSources.length === 0 ? <Empty>No tagged visits yet.</Empty> : (
            <div className="admin-breakdown-list">
              {analytics.utmSources.map(u => (
                <BreakdownRow key={u.source} label={u.source} value={u.count} total={views} mono />
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Devices">
          {analytics.devices.length === 0 ? <Empty>No data yet.</Empty> : (
            <div className="admin-breakdown-list">
              {analytics.devices.map(d => (
                <BreakdownRow
                  key={d.device}
                  label={d.device.charAt(0).toUpperCase() + d.device.slice(1)}
                  value={d.count}
                  total={views}
                />
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Countries">
          {analytics.countries.length === 0 ? <Empty>No data yet.</Empty> : (
            <div className="admin-breakdown-list">
              {analytics.countries.slice(0, 7).map(c => (
                <BreakdownRow key={c.country} label={c.country} value={c.count} total={views} />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
