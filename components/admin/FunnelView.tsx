'use client'

import { useMemo } from 'react'
import { buildSourceTable, type Person, type PurchaseRow } from '@/lib/admin-people'
import type { AnalyticsData } from './types'
import { BreakdownRow, Empty, fmtMoney, Panel } from './ui'

/** Visit to paid, and which sources bring buyers rather than clicks. */
export default function FunnelView({ people, purchases, analytics }: {
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

  return (
    <>
      <Panel
        title="Visit to paid"
        note="Counted in people, as a share of site visitors. People can skip steps, so a lower step can be larger than the one above it. Days before Nov 14 2026 include a crawler and daily-reset visitor ids, so ranges reaching back that far start the funnel high."
      >
        {failed.includes('funnel') ? <Empty>Couldn&rsquo;t load the funnel.</Empty> : (
          <div className="admin-breakdown-list">
            {analytics.funnel.map(step => (
              <BreakdownRow
                key={step.key}
                label={step.label}
                value={step.count}
                total={top}
                color={step.key === 'purchase' ? 'var(--up)' : 'var(--brand)'}
              />
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="By source"
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

      <Panel
        title="Signup asks"
        note="Each place on the site that asks a visitor to sign up. Seen counts people once per browser session; a signup is credited to the ask that browser last clicked, so one opened on another device (a magic link on a phone) is not counted here."
      >
        {failed.includes('prompts') ? <Empty>Couldn&rsquo;t load the signup asks.</Empty>
          : (analytics.prompts ?? []).length === 0 ? <Empty>No signup asks recorded in this range yet.</Empty> : (
          <div className="admin-table-wrap">
            <table className="admin-table adm-sources">
              <thead>
                <tr>
                  <th>Ask</th>
                  <th>Seen</th>
                  <th>Clicked</th>
                  <th>Click rate</th>
                  <th>Signed up</th>
                </tr>
              </thead>
              <tbody>
                {analytics.prompts.map(p => (
                  <tr key={p.context}>
                    <td className="adm-mono">{PROMPT_LABEL[p.context] ?? p.context}</td>
                    <td>{p.views.toLocaleString()}</td>
                    <td>{p.clicks.toLocaleString()}</td>
                    <td>{p.views > 0 ? `${((p.clicks / p.views) * 100).toFixed(1)}%` : '—'}</td>
                    <td>{p.signups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}

/** Friendly names for the placements; anything unlisted shows its raw key. */
const PROMPT_LABEL: Record<string, string> = {
  home_card_locked: "Home · Tonight's card lock",
  home_card_live: "Home · Tonight's card, live game",
  home_next_live: 'Home · live games bar',
  desk_game_locked: 'Desk game · locked pick',
  sticky_bar: 'Phone · sticky bar',
  follow_team: 'Follow a team',
  vault_free_row: 'Vault · free row lock',
}
