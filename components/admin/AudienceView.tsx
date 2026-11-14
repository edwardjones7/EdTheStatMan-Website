'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeTier, TIERS, TIER_SHORT_LABEL, type Tier } from '@/lib/access'
import {
  AUDIENCE_FILTERS, AUDIENCE_LABEL, audienceCounts, matchesFilter,
  type AudienceFilter, type Person, type PersonStatus,
} from '@/lib/admin-people'
import { Empty, fmtDate, fmtMoney, timeAgo } from './ui'

const PAID_TIERS: Tier[] = TIERS.filter(t => t !== 'retail')

const STATUS_LABEL: Record<PersonStatus, string> = {
  admin: 'Admin', paying: 'Paying', trial: 'Trial', comp: 'Comp',
  lapsed: 'Lapsed', trial_ended: 'Trial ended', free: 'Free',
}

const STATUS_CLASS: Record<PersonStatus, string> = {
  admin: 'admin-badge--gold', paying: 'admin-badge--green', trial: 'admin-badge--blue',
  comp: 'admin-badge--purple', lapsed: 'admin-badge--red', trial_ended: 'admin-badge--yellow',
  free: 'admin-badge--muted',
}

function emailState(p: Person): { label: string; className: string } {
  if (!p.confirmed) return { label: 'Unconfirmed', className: 'admin-badge--yellow' }
  if (p.subscriber) return { label: 'On', className: 'admin-badge--green' }
  return { label: 'Off', className: 'admin-badge--muted' }
}

export default function AudienceView({ people, filter, setFilter, unsubscribeTracked }: {
  people: Person[]
  filter: AudienceFilter
  setFilter: (f: AudienceFilter) => void
  unsubscribeTracked: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const counts = useMemo(() => audienceCounts(people), [people])

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return people.filter(p =>
      matchesFilter(p, filter) &&
      (!q || p.email.toLowerCase().includes(q) || (p.full_name ?? '').toLowerCase().includes(q)))
  }, [people, filter, search])

  const emailOff = people.filter(p => p.confirmed && !p.is_admin && !p.notify_email).length

  return (
    <div className="admin-section">
      <div className="adm-list-stats">
        <div><strong>{counts.subscribers.toLocaleString()}</strong> can be emailed</div>
        <div><strong>{counts.wordpress.toLocaleString()}</strong> from WordPress</div>
        <div title={unsubscribeTracked ? undefined : 'Dates start once the admin_01_dashboard migration runs'}>
          <strong>{emailOff.toLocaleString()}</strong> switched email off
        </div>
        <div><strong>{counts.unconfirmed.toLocaleString()}</strong> unconfirmed, mostly bots</div>
      </div>

      <div className="admin-section__toolbar">
        <input
          className="admin-search"
          type="search"
          placeholder="Search by name or email…"
          aria-label="Search people"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="admin-filters">
          {AUDIENCE_FILTERS.map(f => (
            <button
              key={f}
              type="button"
              className={`admin-filter-btn ${filter === f ? 'admin-filter-btn--active' : ''}`}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {AUDIENCE_LABEL[f]} <span className="adm-count">{counts[f]}</span>
            </button>
          ))}
        </div>
        {filter === 'unconfirmed' ? (
          <span className="admin-muted adm-export-note">Unconfirmed rows can&rsquo;t be exported</span>
        ) : (
          <a className="btn btn--primary btn--sm" href={`/api/admin/audience/export?filter=${filter}`}>
            Export CSV
          </a>
        )}
      </div>

      <p className="admin-count">Showing {rows.length} of {people.length} people</p>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Person</th>
              <th>Status</th>
              <th>Access</th>
              <th>Email</th>
              <th>Source</th>
              <th>Spent</th>
              <th>Last active</th>
              <th>Comp</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="admin-table__empty">Nobody here.</td></tr>
            ) : rows.map(p => {
              const email = emailState(p)
              const ended = p.status === 'lapsed' || p.status === 'trial_ended'
              return (
                <tr key={p.id}>
                  <td>
                    <div className="admin-user-cell">
                      <div className="admin-avatar">{(p.full_name ?? p.email).charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="admin-user-name" title={`Joined ${fmtDate(p.created_at)}`}>
                          {p.full_name ?? <span className="admin-muted">—</span>}
                        </div>
                        <div className="admin-user-email">{p.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`admin-badge ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    {p.subscription_status === 'past_due' && (
                      <div className="admin-cell-note adm-warn">payment failed</div>
                    )}
                  </td>
                  <td>
                    {p.is_admin ? <span className="admin-muted">always</span>
                      : p.tier !== 'retail' ? (
                        <>
                          {TIER_SHORT_LABEL[p.tier]}
                          <div className="admin-muted admin-cell-note">until {fmtDate(p.access_expires_at!)}</div>
                        </>
                      ) : ended && p.access_expires_at ? (
                        <span className="admin-muted">ended {fmtDate(p.access_expires_at)}</span>
                      ) : <span className="admin-muted">—</span>}
                  </td>
                  <td><span className={`admin-badge ${email.className}`}>{email.label}</span></td>
                  <td className="admin-muted">{p.source}</td>
                  <td className={p.spentCents ? undefined : 'admin-muted'}>
                    {p.spentCents ? fmtMoney(p.spentCents) : '—'}
                  </td>
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
