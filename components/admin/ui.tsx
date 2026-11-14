import type { ReactNode } from 'react'

export function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

export function fmtDuration(secs: number): string {
  const s = Math.round(secs)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function timeAgo(iso: string | null): string {
  if (!iso) return 'Never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmtDate(iso)
}

/**
 * Change against the prior period, in the units of the number itself. With
 * counts this small a percentage swings wildly: one signup to two is "+100%".
 */
export function Delta({ now, prev, format = String }: {
  now: number
  prev: number
  format?: (n: number) => string
}) {
  const diff = now - prev
  if (diff === 0) return <span className="adm-delta">no change</span>
  return (
    <span className={`adm-delta adm-delta--${diff > 0 ? 'up' : 'down'}`}>
      {diff > 0 ? '▲' : '▼'} {format(Math.abs(diff))}
    </span>
  )
}

export function Kpi({ label, value, delta, sub, source }: {
  label: string
  value: string | number
  delta?: ReactNode
  sub?: ReactNode
  /** Where the number comes from and what it leaves out, in a few words. */
  source?: ReactNode
}) {
  return (
    <div className="adm-kpi">
      <div className="adm-kpi__label">{label}</div>
      <div className="adm-kpi__value">{value}</div>
      {delta && <div className="adm-kpi__delta">{delta}</div>}
      {sub && <div className="adm-kpi__sub">{sub}</div>}
      {source && <div className="adm-kpi__src">{source}</div>}
    </div>
  )
}

/**
 * What somebody holds today, as one label. Every account lands in exactly one,
 * so counts by membership always add up to the number of accounts.
 */
export type Membership =
  | 'desk' | 'private' | 'portfolio' | 'trial' | 'comp' | 'lapsed' | 'free' | 'admin'

export const MEMBERSHIP_LABEL: Record<Membership, string> = {
  desk: 'Research Desk', private: 'Vault', portfolio: 'Portfolio', trial: 'Free trial',
  comp: 'Comp', lapsed: 'Lapsed', free: 'Free', admin: 'Admin',
}

/** Bar and dot colours, in the order the membership bar draws them. */
export const MEMBERSHIP_ORDER: Membership[] = ['desk', 'private', 'portfolio', 'trial', 'comp', 'lapsed', 'free']
export const MEMBERSHIP_COLOR: Record<Membership, string> = {
  desk: 'var(--brand)', private: '#8FBBFF', portfolio: '#5B8DEF', trial: 'var(--up)',
  comp: '#B58BFF', lapsed: '#FFB86B', free: '#3A4A63', admin: '#3A4A63',
}

export function membershipOf(p: { status: string; tier: string }): Membership {
  switch (p.status) {
    case 'admin': return 'admin'
    case 'trial': return 'trial'
    case 'comp': return 'comp'
    case 'lapsed':
    case 'trial_ended': return 'lapsed'
    case 'paying':
      return p.tier === 'desk' || p.tier === 'private' || p.tier === 'portfolio' ? p.tier : 'free'
    default: return 'free'
  }
}

export function Badge({ tone = 'muted', children }: {
  tone?: 'green' | 'blue' | 'gold' | 'red' | 'yellow' | 'purple' | 'muted'
  children: ReactNode
}) {
  return <span className={`admin-badge admin-badge--${tone}`}>{children}</span>
}

export function Panel({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="admin-breakdown-card">
      <h3 className="admin-breakdown-card__title">{title}</h3>
      {children}
      {note && <p className="adm-note">{note}</p>}
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="admin-muted adm-empty">{children}</p>
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="adm-notice" role="alert">{children}</div>
}

export function BreakdownRow({ label, value, total, color = 'var(--accent-teal)', mono }: {
  label: string
  value: number
  total: number
  color?: string
  mono?: boolean
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="admin-breakdown-row">
      <div className="admin-breakdown-row__left">
        <span className="admin-breakdown-row__dot" style={{ background: color }} />
        <span className={`admin-breakdown-row__label${mono ? ' adm-mono' : ''}`}>{label}</span>
      </div>
      <div className="admin-breakdown-row__right">
        <div className="admin-breakdown-row__bar-track">
          <div className="admin-breakdown-row__bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
        </div>
        <span className="admin-breakdown-row__value">{value.toLocaleString()}</span>
        <span className="admin-breakdown-row__pct">{value > 0 && pct === 0 ? '<1' : pct}%</span>
      </div>
    </div>
  )
}
