'use client'

import { useMemo } from 'react'
import { buildSourceTable, type Person, type PurchaseRow } from '@/lib/admin-people'
import type { AnalyticsData } from './types'
import { BreakdownRow, Empty, fmtDuration, fmtMoney, Panel } from './ui'

export default function GrowthView({ people, purchases, analytics }: {
  people: Person[]
  purchases: PurchaseRow[]
  analytics: AnalyticsData
}) {
  const { failed, window: w } = analytics
  const sources = useMemo(
    () => buildSourceTable(analytics.sources, people, purchases, { from: w.from, to: w.to }),
    [analytics.sources, people, purchases, w.from, w.to],
  )
  const top = analytics.funnel[0]?.count ?? 0
  const views = analytics.viewsInRange

  return (
    <>
      <Panel
        title="Funnel"
        note="Counted in people, as a share of site visitors. People can skip steps, so a lower step can be larger than the one above it. Visitor ids reset daily, so somebody who comes back on another day counts again."
      >
        {failed.includes('funnel') ? <Empty>Couldn&rsquo;t load the funnel.</Empty> : (
          <div className="admin-breakdown-list">
            {analytics.funnel.map(step => (
              <BreakdownRow
                key={step.key}
                label={step.label}
                value={step.count}
                total={top}
                color={step.key === 'purchase' ? 'var(--accent-gold)' : undefined}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Where it comes from"
        note={analytics.sources === null
          ? 'Visitors per source needs the admin_01_dashboard migration. Signups, trials and revenue are complete without it.'
          : 'First-touch source for signups and trials. Sales use the source saved at checkout, then the buyer’s own.'}
      >
        {sources.length === 0 ? <Empty>Nothing in this range yet.</Empty> : (
          <div className="admin-table-wrap">
            <table className="admin-table adm-sources">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Visitors</th>
                  <th>Signups</th>
                  <th>Trials</th>
                  <th>Sales</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {sources.map(s => (
                  <tr key={s.source}>
                    <td className="adm-mono">{s.source}</td>
                    <td>{s.visitors === null ? '—' : s.visitors.toLocaleString()}</td>
                    <td>{s.signups}</td>
                    <td>{s.trials}</td>
                    <td>{s.sales}</td>
                    <td>{fmtMoney(s.revenueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

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

      <details className="adm-details">
        <summary>Traffic detail</summary>
        <p className="adm-note">
          {analytics.sessions.toLocaleString()} sessions · {Math.round(analytics.bounceRate * 100)}% bounce · {fmtDuration(analytics.avgSessionSecs)} average session · {analytics.totalViews.toLocaleString()} views all time
        </p>
        <div className="adm-grid-2">
          <Panel title="Referrers">
            {analytics.referrers.length === 0 ? <Empty>No referrer data yet.</Empty> : (
              <div className="admin-breakdown-list">
                {analytics.referrers.map(r => (
                  <BreakdownRow key={r.source} label={r.source} value={r.count} total={views} mono />
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Campaigns">
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
      </details>
    </>
  )
}
