'use client'

import type { Ops } from '@/lib/admin-people-server'
import { Empty, Panel, timeAgo } from './ui'

const JOB_STATE_LABEL = { ok: 'OK', failed: 'Failed', late: 'Late', waiting: 'Waiting for first run' }
const JOB_STATE_CLASS = {
  ok: 'admin-badge--green', failed: 'admin-badge--red', late: 'admin-badge--yellow', waiting: 'admin-badge--muted',
}

/**
 * The known limits of every number on this dashboard, in one place. Each line
 * is something checked in the code; delete it when the fix lands.
 */
const LIMITS: { area: string; text: string }[] = [
  { area: 'Visitors', text: 'Visitor ids are a hash of IP and browser that resets every day, so one person on several days counts several times. Week, month and year visitor totals run high.' },
  { area: 'Page views', text: 'Admin accounts are only skipped on /admin pages, so our own browsing of the site is counted.' },
  { area: 'Page views', text: 'Views are reported to /api/track, a path some ad blockers block, so a share of real visitors is missing.' },
  { area: 'Bots', text: 'Bots are filtered by user agent only. A scraper that claims to be a normal browser is counted.' },
  { area: 'Revenue', text: 'The purchases ledger starts on Aug 11 2026. Earlier sales are not in any figure.' },
  { area: 'Subscribers', text: 'There is no separate list yet: a subscriber is a confirmed account with email on. Bounces are not tracked.' },
]

export default function SystemView({ ops }: { ops: Ops }) {
  return (
    <>
      <Panel title="Scheduled jobs" note="From job_runs. Late means the job has not reported within its expected window.">
        {ops.jobsState === 'missing' && <Empty>Not set up yet. Needs the admin_01_dashboard migration.</Empty>}
        {ops.jobsState === 'failed' && <Empty>Couldn&rsquo;t load job history.</Empty>}
        {ops.jobs && (
          <div className="admin-table-wrap">
            <table className="admin-table adm-sources">
              <thead><tr><th>Job</th><th>Status</th><th>Last run</th><th>Last error</th></tr></thead>
              <tbody>
                {ops.jobs.map(j => (
                  <tr key={j.job}>
                    <td className="adm-mono">{j.job}</td>
                    <td><span className={`admin-badge ${JOB_STATE_CLASS[j.state]}`}>{JOB_STATE_LABEL[j.state]}</span></td>
                    <td className="admin-muted">{j.lastRun ? timeAgo(j.lastRun) : '—'}</td>
                    <td className="admin-muted">{j.error ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="adm-grid-2">
        <Panel title="Picks needing attention">
          <ul className="adm-list">
            <li>
              <span className="adm-list__main">{ops.pendingPicks ?? '—'} waiting for approval</span>
              <span className="adm-list__side">Pick drafts in the queue</span>
            </li>
            <li>
              <span className="adm-list__main">{ops.ungradedPicks ?? '—'} ungraded after 2 days</span>
              <span className="adm-list__side">Posted over 2 days ago, result still pending</span>
            </li>
          </ul>
        </Panel>
        <Panel title="Deployed version">
          <p className="adm-big">v{process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'}</p>
          <p className="adm-note">The main branch is production and every push builds, so this is the release Vercel is actually serving.</p>
        </Panel>
      </div>

      <Panel title="How far to trust the numbers" note="Fixing these is the next piece of work. Each line goes when its fix ships.">
        <ul className="adm-limits">
          {LIMITS.map((l, i) => (
            <li key={i}><strong>{l.area}</strong>{l.text}</li>
          ))}
        </ul>
      </Panel>
    </>
  )
}
