'use client'

import { useMemo, useState } from 'react'
import {
  audienceCounts, bucketTotals, DAY_MS, isSignupIn, periodFigures,
  type Person, type PurchaseRow,
} from '@/lib/admin-people'
import type { Ops } from '@/lib/admin-people-server'
import { TIER_SHORT_LABEL } from '@/lib/access'
import type { AnalyticsData, Go, Range } from './types'
import { Delta, Empty, fmtMoney, fmtShort, Kpi, Panel, timeAgo } from './ui'

const PRIOR: Record<Range, string> = { week: 'prior 7 days', month: 'prior 30 days', year: 'prior year' }

type Metric = 'views' | 'signups' | 'revenue'
const METRIC_LABEL: Record<Metric, string> = { views: 'Page views', signups: 'Signups', revenue: 'Revenue' }

const TRIAL_WARNING_MS = 3 * DAY_MS

const JOB_STATE_LABEL = { ok: 'OK', failed: 'Failed', late: 'Late', waiting: 'Waiting for first run' }
const JOB_STATE_CLASS = {
  ok: 'admin-badge--green', failed: 'admin-badge--red', late: 'admin-badge--yellow', waiting: 'admin-badge--muted',
}

interface Alert { key: string; text: string; onClick: () => void }

function buildAlerts(people: Person[], ops: Ops, go: Go): Alert[] {
  const now = Date.now()
  const endingSoon = people.filter(p =>
    p.status === 'trial' && new Date(p.access_expires_at ?? 0).getTime() - now < TRIAL_WARNING_MS).length
  const pastDue = people.filter(p => p.subscription_status === 'past_due').length
  const badJobs = (ops.jobs ?? []).filter(j => j.state === 'failed' || j.state === 'late')
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

  const alerts: (Alert | false)[] = [
    !!ops.pendingPicks && {
      key: 'pending', text: `${plural(ops.pendingPicks, 'pick')} waiting for approval`, onClick: () => go('content'),
    },
    !!ops.ungradedPicks && {
      key: 'ungraded', text: `${plural(ops.ungradedPicks, 'pick')} still ungraded after 2 days`, onClick: () => go('content'),
    },
    endingSoon > 0 && {
      key: 'trials', text: `${plural(endingSoon, 'trial')} ending within 3 days`, onClick: () => go('audience', 'trial'),
    },
    pastDue > 0 && {
      key: 'pastdue', text: `${plural(pastDue, 'failed payment')}`, onClick: () => go('audience', 'paying'),
    },
    badJobs.length > 0 && {
      key: 'jobs',
      text: `Daily job problem: ${badJobs.map(j => j.job).join(', ')}`,
      onClick: () => document.getElementById('adm-jobs')?.scrollIntoView({ behavior: 'smooth' }),
    },
  ]
  return alerts.filter((a): a is Alert => !!a)
}

export default function OverviewView({ people, purchases, peopleFailed, ops, analytics, range, loading, go }: {
  people: Person[]
  /** The figures below are unknown, so they show a dash rather than 0. */
  peopleFailed: boolean
  purchases: PurchaseRow[]
  ops: Ops
  analytics: AnalyticsData
  range: Range
  loading: boolean
  go: Go
}) {
  const [metric, setMetric] = useState<Metric>('views')
  const [hovered, setHovered] = useState<number | null>(null)

  const { window: w, failed } = analytics
  const period = useMemo(() => ({ from: w.from, to: w.to }), [w.from, w.to])
  const prior = useMemo(() => ({ from: w.prevFrom, to: w.prevTo }), [w.prevFrom, w.prevTo])

  const now = useMemo(() => periodFigures(people, purchases, period), [people, purchases, period])
  const before = useMemo(() => periodFigures(people, purchases, prior), [people, purchases, prior])
  const counts = useMemo(() => audienceCounts(people), [people])
  const alerts = useMemo(() => buildAlerts(people, ops, go), [people, ops, go])

  const unsubscribed = ops.unsubscribes?.filter(at => {
    const t = Date.parse(at)
    return t >= Date.parse(w.from) && t < Date.parse(w.to)
  }).length ?? null
  const allTimeRevenue = useMemo(() => purchases.reduce((s, p) => s + p.amount_cents, 0), [purchases])

  const series = useMemo(() => {
    const dates = analytics.points.map(p => p.date)
    if (metric === 'views') return analytics.points.map(p => p.count)
    if (metric === 'signups') {
      return bucketTotals(dates, people.filter(p => isSignupIn(p, period)).map(p => ({ at: p.created_at, amount: 1 })))
    }
    return bucketTotals(dates, purchases.map(p => ({ at: p.created_at, amount: p.amount_cents })))
  }, [analytics.points, metric, people, purchases, period])

  const peak = Math.max(...series, 1)
  const fmtPoint = (n: number) => metric === 'revenue' ? fmtMoney(n) : n.toLocaleString()
  const viewsFailed = failed.includes('views')

  const recentSignups = useMemo(() =>
    people.filter(p => p.confirmed && !p.imported && !p.is_admin)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6),
  [people])

  const recentSales = useMemo(() => {
    const emails = new Map(people.map(p => [p.id, p.email]))
    return [...purchases]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 6)
      .map(s => ({ ...s, email: emails.get(s.user_id ?? '') ?? 'Deleted account' }))
  }, [people, purchases])

  return (
    <>
      {alerts.length > 0 && (
        <div className="adm-alerts" aria-label="Needs attention">
          {alerts.map(a => (
            <button key={a.key} type="button" className="adm-alert" onClick={a.onClick}>{a.text} →</button>
          ))}
        </div>
      )}

      <div className="adm-kpis" aria-busy={loading}>
        <Kpi
          label="Revenue"
          value={peopleFailed ? '—' : fmtMoney(now.revenueCents)}
          delta={<><Delta now={now.revenueCents} prev={before.revenueCents} format={fmtMoney} /> vs {PRIOR[range]}</>}
          sub={`${now.sales} sale${now.sales === 1 ? '' : 's'} · ${fmtMoney(allTimeRevenue)} all time`}
        />
        <Kpi
          label="Signups"
          value={peopleFailed ? '—' : now.signups}
          delta={<><Delta now={now.signups} prev={before.signups} /> vs {PRIOR[range]}</>}
          sub={`${now.trials} trial${now.trials === 1 ? '' : 's'} started`}
        />
        <Kpi
          label="Page views"
          value={viewsFailed ? '—' : analytics.viewsInRange.toLocaleString()}
          delta={viewsFailed ? undefined : <><Delta now={analytics.viewsInRange} prev={analytics.prevViews} format={n => n.toLocaleString()} /> vs {PRIOR[range]}</>}
          sub={`${analytics.uniqueVisitors.toLocaleString()} visitors`}
        />
        <Kpi
          label="Paying members"
          value={peopleFailed ? '—' : counts.paying}
          sub={`${counts.trial} on trial · ${counts.comp} comped`}
        />
        <Kpi
          label="Email subscribers"
          value={peopleFailed ? '—' : counts.subscribers}
          delta={<>+{now.newSubscribers} new{unsubscribed !== null && <> · {unsubscribed} left</>}</>}
          sub={`${counts.unconfirmed} unconfirmed, not counted`}
        />
      </div>

      <Panel title="Trend">
        <div className="adm-switch" role="group" aria-label="Chart metric">
          {(Object.keys(METRIC_LABEL) as Metric[]).map(m => (
            <button
              key={m}
              type="button"
              className={`admin-filter-btn ${metric === m ? 'admin-filter-btn--active' : ''}`}
              aria-pressed={metric === m}
              onClick={() => setMetric(m)}
            >
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>
        {metric === 'views' && failed.includes('chart') ? (
          <Empty>Couldn&rsquo;t load the chart.</Empty>
        ) : (
          <>
            <div className="analytics-chart adm-chart">
              {series.map((value, i) => (
                <div
                  key={analytics.points[i]?.date ?? i}
                  className="analytics-chart__col"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {hovered === i && (
                    <div className="analytics-bar-tooltip">
                      {analytics.points[i]?.label}: {fmtPoint(value)}
                    </div>
                  )}
                  <div
                    className="analytics-chart__bar"
                    style={{ height: `${Math.max((value / peak) * 100, value > 0 ? 3 : 0)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="adm-axis">
              <span>{analytics.points[0]?.label}</span>
              <span>{analytics.points[Math.floor(analytics.points.length / 2)]?.label}</span>
              <span>{analytics.points[analytics.points.length - 1]?.label}</span>
            </div>
          </>
        )}
      </Panel>

      <div className="adm-grid-3">
        <Panel title="Latest signups">
          {recentSignups.length === 0 ? <Empty>No signups yet.</Empty> : (
            <ul className="adm-list">
              {recentSignups.map(p => (
                <li key={p.id}>
                  <span className="adm-list__main">{p.email}</span>
                  <span className="adm-list__side">{fmtShort(p.created_at)} · {p.source}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Latest sales">
          {recentSales.length === 0 ? <Empty>No sales yet.</Empty> : (
            <ul className="adm-list">
              {recentSales.map((s, i) => (
                <li key={`${s.created_at}-${i}`}>
                  <span className="adm-list__main">{s.email}</span>
                  <span className="adm-list__side">
                    {fmtMoney(s.amount_cents)} · {TIER_SHORT_LABEL[s.tier as keyof typeof TIER_SHORT_LABEL] ?? s.tier} · {fmtShort(s.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div id="adm-jobs">
          <Panel title="Daily jobs">
            {ops.jobsState === 'missing' && <Empty>Not set up yet. Needs the admin_01_dashboard migration.</Empty>}
            {ops.jobsState === 'failed' && <Empty>Couldn&rsquo;t load job history.</Empty>}
            {ops.jobs && (
              <ul className="adm-list">
                {ops.jobs.map(j => (
                  <li key={j.job} title={j.error ?? undefined}>
                    <span className="adm-list__main adm-mono">{j.job}</span>
                    <span className="adm-list__side">
                      <span className={`admin-badge ${JOB_STATE_CLASS[j.state]}`}>{JOB_STATE_LABEL[j.state]}</span>
                      {j.lastRun && <> {timeAgo(j.lastRun)}</>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  )
}
