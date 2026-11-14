'use client'

import { useMemo, useState } from 'react'
import { periodFigures, toCsv, type Person, type PurchaseRow } from '@/lib/admin-people'
import type { AnalyticsData } from './types'
import { Empty, fmtDate, Kpi, membershipOf, MEMBERSHIP_LABEL, timeAgo } from './ui'
import { downloadCsv } from './UsersView'

/**
 * The email list, kept apart from accounts. Today the list IS the accounts:
 * every confirmed account is on it unless it switched email off, and the
 * free-picks box creates an account too. A table of its own (with bounces from
 * Resend and people who never made an account) is the next step; until then
 * this view says exactly what it counts.
 */
const FILTERS = ['subscribed', 'off', 'wordpress', 'members', 'never'] as const
type Filter = (typeof FILTERS)[number]

const LABEL: Record<Filter, string> = {
  subscribed: 'Subscribed',
  off: 'Switched off',
  wordpress: 'WordPress imports',
  members: 'Paying members',
  never: 'Never signed in',
}

const onList = (p: Person) => p.subscriber
const listed = (p: Person) => p.confirmed && !p.is_admin

function matches(p: Person, f: Filter): boolean {
  if (!listed(p)) return false
  switch (f) {
    case 'subscribed': return onList(p)
    case 'off': return !onList(p)
    case 'wordpress': return p.imported
    case 'members': return onList(p) && p.status === 'paying'
    case 'never': return onList(p) && !p.last_seen_at
  }
}

export default function SubscribersView({ people, purchases, analytics, unsubscribes }: {
  people: Person[]
  purchases: PurchaseRow[]
  analytics: AnalyticsData
  /** When each unsubscribe happened; null until the admin_01 migration adds the column. */
  unsubscribes: string[] | null
}) {
  const [filter, setFilter] = useState<Filter>('subscribed')
  const [search, setSearch] = useState('')
  const w = analytics.window

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map(f => [f, people.filter(p => matches(p, f)).length])) as Record<Filter, number>,
    [people],
  )
  const joined = useMemo(
    () => periodFigures(people, purchases, { from: w.from, to: w.to }).newSubscribers,
    [people, purchases, w.from, w.to],
  )
  const left = unsubscribes?.filter(at => {
    const t = Date.parse(at)
    return t >= Date.parse(w.from) && t < Date.parse(w.to)
  }).length ?? null
  const unconfirmed = people.filter(p => !p.confirmed).length

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return people
      .filter(p => matches(p, filter) && (!q || p.email.toLowerCase().includes(q)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [people, filter, search])

  return (
    <>
      <p className="adm-rule">
        Every account joins this list once its email is confirmed. Switching email off leaves the list, never the account.
      </p>

      <div className="adm-kpis">
        <Kpi label="Subscribed" value={counts.subscribed.toLocaleString()} source="Confirmed, email on, admins excluded" />
        <Kpi label="Joined in range" value={joined} source="New confirmed accounts with email on" />
        <Kpi
          label="Left in range"
          value={left === null ? '—' : left}
          source={left === null ? 'Needs the admin_01 migration to date unsubscribes' : 'Switched email off'}
        />
        <Kpi label="WordPress imports" value={counts.wordpress} sub={`${counts.never} never signed in`} source="Carried over from the old site" />
        <Kpi label="Not on the list" value={unconfirmed} source="Unconfirmed signups, mostly bots" />
      </div>

      <div className="admin-section">
        <div className="admin-section__toolbar">
          <input
            className="admin-search"
            type="search"
            placeholder="Search email…"
            aria-label="Search subscribers"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="admin-filters">
            {FILTERS.map(f => (
              <button
                key={f}
                type="button"
                className={`admin-filter-btn ${filter === f ? 'admin-filter-btn--active' : ''}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {LABEL[f]} <span className="adm-count">{counts[f]}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => downloadCsv(`subscribers-${filter}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))}
          >
            Export CSV
          </button>
        </div>

        <p className="admin-count">Showing {rows.length}</p>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Status</th>
                <th>Joined list</th>
                <th>How</th>
                <th>Membership</th>
                <th>Last seen on site</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} className="admin-table__empty">Nobody here.</td></tr>
              ) : rows.map(p => (
                <tr key={p.id}>
                  <td>{p.email}</td>
                  <td>
                    {onList(p)
                      ? <span className="admin-badge admin-badge--green">Subscribed</span>
                      : <span className="admin-badge admin-badge--muted">Switched off</span>}
                  </td>
                  <td className="admin-muted">{p.imported ? 'WordPress import' : fmtDate(p.created_at)}</td>
                  <td className="admin-muted">{p.imported ? 'Old site' : 'Account signup'}</td>
                  <td>{MEMBERSHIP_LABEL[membershipOf(p)]}</td>
                  <td className="admin-muted">{timeAgo(p.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && search && <Empty>Try a different search.</Empty>}
      </div>
    </>
  )
}
