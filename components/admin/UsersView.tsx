'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeTier, TIERS, TIER_SHORT_LABEL, type Tier } from '@/lib/access'
import { toCsv, type Person } from '@/lib/admin-people'
import {
  Empty, fmtDate, fmtMoney, Kpi, membershipOf, MEMBERSHIP_COLOR, MEMBERSHIP_LABEL, MEMBERSHIP_ORDER,
  timeAgo, type Membership,
} from './ui'

const PAID_TIERS: Tier[] = TIERS.filter(t => t !== 'retail')

const MEMBERSHIP_TONE: Record<Membership, string> = {
  desk: 'admin-badge--blue', private: 'admin-badge--blue', portfolio: 'admin-badge--blue',
  trial: 'admin-badge--green', comp: 'admin-badge--purple', lapsed: 'admin-badge--yellow',
  free: 'admin-badge--muted', admin: 'admin-badge--gold',
}

/** Filters on this view: everyone, all paying, each membership, then the rows that are not real members. */
export const USER_FILTERS = ['all', 'paying', ...MEMBERSHIP_ORDER, 'unconfirmed', 'admin'] as const
export type UserFilter = (typeof USER_FILTERS)[number]

const FILTER_LABEL: Record<UserFilter, string> = {
  all: 'All accounts', paying: 'All paying', ...MEMBERSHIP_LABEL, unconfirmed: 'Unconfirmed', admin: 'Admins',
}

/**
 * The accounts that count. Unconfirmed rows are mostly the September signup
 * bot and admins are us, so neither is a user in any total on this page.
 */
const isAccount = (p: Person) => p.confirmed && !p.is_admin

function matches(p: Person, f: UserFilter): boolean {
  if (f === 'unconfirmed') return !p.confirmed
  if (f === 'admin') return p.is_admin
  if (!isAccount(p)) return false
  if (f === 'all') return true
  if (f === 'paying') return p.status === 'paying'
  return membershipOf(p) === f
}

export function downloadCsv(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function UsersView({ people, filter, setFilter }: {
  people: Person[]
  filter: UserFilter
  setFilter: (f: UserFilter) => void
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')

  const accounts = useMemo(() => people.filter(isAccount), [people])
  const counts = useMemo(
    () => Object.fromEntries(USER_FILTERS.map(f => [f, people.filter(p => matches(p, f)).length])) as Record<UserFilter, number>,
    [people],
  )
  const avgSpend = useMemo(() => {
    const payers = accounts.filter(p => p.spentCents > 0)
    return payers.length ? payers.reduce((s, p) => s + p.spentCents, 0) / payers.length : 0
  }, [accounts])

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return people.filter(p =>
      matches(p, filter) &&
      (!q || p.email.toLowerCase().includes(q) || (p.full_name ?? '').toLowerCase().includes(q)))
  }, [people, filter, search])

  return (
    <>
      <div className="adm-kpis">
        <Kpi label="Accounts" value={accounts.length.toLocaleString()} source="Confirmed email · admins excluded" />
        <Kpi label="Paying members" value={counts.paying} source="Live paid pass today" />
        <Kpi label="On free trial" value={counts.trial} source="7-day Research Desk trial, live" />
        <Kpi label="Lapsed" value={counts.lapsed} source="Paid or trialled before, access ended" />
        <Kpi
          label="Average spend"
          value={avgSpend ? fmtMoney(avgSpend) : '—'}
          source="Per account that has paid (ledger)"
        />
      </div>

      <section className="admin-breakdown-card">
        <h3 className="admin-breakdown-card__title">Who has what</h3>
        <div className="adm-mix" role="img" aria-label="Accounts by membership">
          {MEMBERSHIP_ORDER.map(m => counts[m] > 0 && (
            <span key={m} style={{ flexGrow: counts[m], background: MEMBERSHIP_COLOR[m] }} title={`${MEMBERSHIP_LABEL[m]}: ${counts[m]}`} />
          ))}
        </div>
        <div className="adm-mix-legend">
          {MEMBERSHIP_ORDER.map(m => (
            <button key={m} type="button" className="adm-mix-key" onClick={() => setFilter(m)}>
              <i style={{ background: MEMBERSHIP_COLOR[m] }} aria-hidden />
              {MEMBERSHIP_LABEL[m]} <strong>{counts[m]}</strong>
            </button>
          ))}
        </div>
        <p className="adm-note">Every account is in exactly one. A past buyer on a live comp counts as paying.</p>
      </section>

      <div className="admin-section">
        <div className="admin-section__toolbar">
          <input
            className="admin-search"
            type="search"
            placeholder="Search by name or email…"
            aria-label="Search accounts"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="admin-filters">
            {USER_FILTERS.map(f => (
              <button
                key={f}
                type="button"
                className={`admin-filter-btn ${filter === f ? 'admin-filter-btn--active' : ''}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {FILTER_LABEL[f]} <span className="adm-count">{counts[f]}</span>
              </button>
            ))}
          </div>
          {filter === 'unconfirmed' ? (
            <span className="admin-muted adm-export-note">Unconfirmed rows can&rsquo;t be exported</span>
          ) : (
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => downloadCsv(`users-${filter}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))}
            >
              Export CSV
            </button>
          )}
        </div>

        <p className="admin-count">Showing {rows.length} of {accounts.length} accounts</p>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Membership</th>
                <th>Access until</th>
                <th>Spent</th>
                <th>Joined</th>
                <th>Email list</th>
                <th>First source</th>
                <th>Last seen</th>
                <th>Comp</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="admin-table__empty">Nobody here.</td></tr>
              ) : rows.map(p => {
                const m = membershipOf(p)
                return (
                  <tr key={p.id}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-avatar">{(p.full_name ?? p.email).charAt(0).toUpperCase()}</div>
                        <div>
                          <div className="admin-user-name">{p.full_name ?? <span className="admin-muted">—</span>}</div>
                          <div className="admin-user-email">{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`admin-badge ${MEMBERSHIP_TONE[m]}`}>
                        {m === 'comp' ? `Comp · ${TIER_SHORT_LABEL[p.tier]}` : MEMBERSHIP_LABEL[m]}
                      </span>
                      {p.status === 'trial_ended' && <div className="admin-cell-note admin-muted">trial ended, never paid</div>}
                      {p.subscription_status === 'past_due' && <div className="admin-cell-note adm-warn">payment failed</div>}
                    </td>
                    <td className="admin-muted">
                      {p.is_admin ? 'always'
                        : p.tier !== 'retail' && p.access_expires_at ? fmtDate(p.access_expires_at)
                        : m === 'lapsed' && p.access_expires_at ? `ended ${fmtDate(p.access_expires_at)}`
                        : '—'}
                    </td>
                    <td className={p.spentCents ? undefined : 'admin-muted'}>{p.spentCents ? fmtMoney(p.spentCents) : '—'}</td>
                    <td className="admin-muted">{p.imported ? 'WordPress import' : fmtDate(p.created_at)}</td>
                    <td>
                      {!p.confirmed ? <span className="admin-badge admin-badge--yellow">Unconfirmed</span>
                        : p.subscriber ? <span className="admin-badge admin-badge--green">On</span>
                        : <span className="admin-badge admin-badge--muted">Off</span>}
                    </td>
                    <td className="admin-muted">{p.source}</td>
                    <td className="admin-muted">{timeAgo(p.last_seen_at)}</td>
                    <td><CompCell person={p} onDone={() => router.refresh()} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && search && <Empty>Try a different search.</Empty>}
      </div>
    </>
  )
}

/**
 * Comp, extend or revoke one member's access, inline in the row.
 *
 * Writes the PASS slot through /api/admin/users/[id]; the subscription slot is
 * Stripe's and is never touched from here. That is what lets a comp sit on top
 * of a paid subscription without either one clobbering the other, and it is why
 * Revoke cannot cancel something a member is paying for.
 */
function CompCell({ person, onDone }: { person: Person; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<Tier>('private')
  const [until, setUntil] = useState('season')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A pass that has already run out is not a comp, it is a leftover. Labelling
  // the row "Private pass / Change" for somebody whose pass ended in May reads
  // as though they still have it.
  const comped =
    !!person.pass_tier &&
    !!person.pass_expires_at &&
    new Date(person.pass_expires_at).getTime() > Date.now()

  async function send(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${person.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      setOpen(false)
      onDone()
    } catch (e: any) {
      setError(e.message ?? 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (person.is_admin) return <span className="admin-muted">—</span>

  if (!open) {
    return (
      <div className="admin-comp">
        {comped && (
          <span className="admin-muted admin-cell-note">
            {TIER_SHORT_LABEL[normalizeTier(person.pass_tier)]} pass
          </span>
        )}
        <button
          className="admin-action-btn"
          onClick={() => { setTier(comped ? normalizeTier(person.pass_tier) : 'private'); setOpen(true) }}
        >
          {comped ? 'Change' : 'Comp'}
        </button>
        {error && <div className="admin-comp__error">{error}</div>}
      </div>
    )
  }

  return (
    <div className="admin-comp admin-comp--open">
      <select className="admin-comp__field" value={tier} onChange={e => setTier(e.target.value as Tier)}>
        {PAID_TIERS.map(t => <option key={t} value={t}>{TIER_SHORT_LABEL[t]}</option>)}
      </select>
      <select className="admin-comp__field" value={until} onChange={e => setUntil(e.target.value)}>
        <option value="season">To the Super Bowl</option>
        <option value="30">30 days</option>
        <option value="365">1 year</option>
      </select>
      <div className="admin-comp__actions">
        <button
          className="admin-action-btn admin-action-btn--primary"
          disabled={busy}
          onClick={() => send({
            action: 'grant',
            tier,
            expiresAt: until === 'season'
              ? 'season'
              : new Date(Date.now() + Number(until) * 86_400_000).toISOString(),
          })}
        >
          {busy ? '…' : 'Apply'}
        </button>
        {comped && (
          <button className="admin-action-btn" disabled={busy} onClick={() => send({ action: 'revoke' })}>
            Revoke
          </button>
        )}
        <button className="admin-action-btn" disabled={busy} onClick={() => { setOpen(false); setError(null) }}>
          Cancel
        </button>
      </div>
      {error && <div className="admin-comp__error">{error}</div>}
    </div>
  )
}
