'use client'

import { useMemo } from 'react'
import { normalizeTier, TIER_SHORT_LABEL } from '@/lib/access'
import { OFFER_PLANS } from '@/lib/offer'
import { DAY_MS, periodFigures, type Person, type PurchaseRow } from '@/lib/admin-people'
import type { AnalyticsData, Go, Range } from './types'
import { Delta, Empty, fmtMoney, fmtShort, Kpi, Panel } from './ui'

const PRIOR: Record<Range, string> = { week: 'prior 7 days', month: 'prior 30 days', year: 'prior year' }
const EXPIRING_MS = 7 * DAY_MS

type Term = '30' | '365' | 'other'

/**
 * Which pass a sale was, read from the price paid. The ledger stores the tier
 * and the amount but not the period, so a sale at a price the offer no longer
 * lists (the older ladder, a coupon) reads as "other" rather than a guess.
 */
function termOf(sale: PurchaseRow): Term {
  const plan = OFFER_PLANS.find(p => p.key === normalizeTier(sale.tier))
  if (!plan) return 'other'
  if (sale.amount_cents === plan.month.amount * 100) return '30'
  if (sale.amount_cents === plan.year.amount * 100) return '365'
  return 'other'
}

function inRange(iso: string, from: string, to: string): boolean {
  const t = Date.parse(iso)
  return t >= Date.parse(from) && t < Date.parse(to)
}

export default function RevenueView({ people, purchases, peopleFailed, analytics, range, go }: {
  people: Person[]
  purchases: PurchaseRow[]
  peopleFailed: boolean
  analytics: AnalyticsData
  range: Range
  go: Go
}) {
  const w = analytics.window
  const now = useMemo(() => periodFigures(people, purchases, { from: w.from, to: w.to }), [people, purchases, w.from, w.to])
  const before = useMemo(() => periodFigures(people, purchases, { from: w.prevFrom, to: w.prevTo }), [people, purchases, w.prevFrom, w.prevTo])

  const sold = useMemo(() => purchases.filter(p => inRange(p.created_at, w.from, w.to)), [purchases, w.from, w.to])
  const allTime = useMemo(() => purchases.reduce((s, p) => s + p.amount_cents, 0), [purchases])
  const buyers = useMemo(() => new Set(purchases.map(p => p.user_id).filter(Boolean)).size, [purchases])
  const paying = people.filter(p => p.status === 'paying').length

  const byProduct = useMemo(() => {
    const rows = new Map<string, { label: string; m30: number; m365: number; other: number; cents: number }>()
    for (const plan of OFFER_PLANS) rows.set(plan.key, { label: plan.name, m30: 0, m365: 0, other: 0, cents: 0 })
    for (const s of sold) {
      const key = normalizeTier(s.tier)
      const row = rows.get(key) ?? { label: TIER_SHORT_LABEL[key] ?? s.tier, m30: 0, m365: 0, other: 0, cents: 0 }
      const term = termOf(s)
      if (term === '30') row.m30++
      else if (term === '365') row.m365++
      else row.other++
      row.cents += s.amount_cents
      rows.set(key, row)
    }
    return [...rows.values()]
  }, [sold])
  const anyOther = byProduct.some(r => r.other > 0)

  const expiring = useMemo(() => {
    const t = Date.now()
    return people
      .filter(p => p.status === 'paying' && p.access_expires_at)
      .filter(p => {
        const left = Date.parse(p.access_expires_at!) - t
        return left > 0 && left <= EXPIRING_MS
      })
      .sort((a, b) => a.access_expires_at!.localeCompare(b.access_expires_at!))
  }, [people])

  const recent = useMemo(() => {
    const emails = new Map(people.map(p => [p.id, p.email]))
    return [...purchases]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 10)
      .map(s => ({ ...s, email: emails.get(s.user_id ?? '') ?? 'Deleted account' }))
  }, [people, purchases])

  const dash = (v: string | number) => (peopleFailed ? '—' : v)

  return (
    <>
      <div className="adm-kpis">
        <Kpi
          label="Revenue"
          value={dash(fmtMoney(now.revenueCents))}
          delta={<><Delta now={now.revenueCents} prev={before.revenueCents} format={fmtMoney} /> vs {PRIOR[range]}</>}
          source="Purchases ledger · gross, before Stripe fees"
        />
        <Kpi
          label="Orders"
          value={dash(now.sales)}
          sub={now.sales ? `avg ${fmtMoney(now.revenueCents / now.sales)}` : undefined}
          source="Paid checkouts in range"
        />
        <Kpi
          label="Paying members now"
          value={dash(paying)}
          sub={`${expiring.length} expire within 7 days`}
          source="Live paid pass · comps and trials excluded"
        />
        <Kpi
          label="All-time revenue"
          value={dash(fmtMoney(allTime))}
          sub={`${buyers} buyer${buyers === 1 ? '' : 's'}`}
          source="Ledger starts Aug 11 2026; earlier sales missing"
        />
      </div>

      <div className="adm-grid-2">
        <Panel
          title="By product"
          note={anyOther ? '“Other” is a sale at a price the current offer does not list, such as the older ladder.' : 'Term read from the price paid.'}
        >
          <div className="admin-table-wrap">
            <table className="admin-table adm-sources">
              <thead>
                <tr><th>Product</th><th>30-day</th><th>365-day</th>{anyOther && <th>Other</th>}<th>Revenue</th></tr>
              </thead>
              <tbody>
                {byProduct.map(r => (
                  <tr key={r.label}>
                    <td>{r.label}</td><td>{r.m30}</td><td>{r.m365}</td>{anyOther && <td>{r.other}</td>}<td>{fmtMoney(r.cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Expiring in the next 7 days" note="Nothing renews on its own, so these are the people to remind.">
          {expiring.length === 0 ? <Empty>No paid passes end this week.</Empty> : (
            <>
              <ul className="adm-list">
                {expiring.map(p => (
                  <li key={p.id}>
                    <span className="adm-list__main">{p.email}</span>
                    <span className="adm-list__side">{TIER_SHORT_LABEL[p.tier]} · ends {fmtShort(p.access_expires_at!)}</span>
                  </li>
                ))}
              </ul>
              <button type="button" className="admin-action-btn adm-gap-top" onClick={() => go('users', 'paying')}>
                See all paying members
              </button>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Latest sales">
        {recent.length === 0 ? <Empty>No sales yet.</Empty> : (
          <div className="admin-table-wrap">
            <table className="admin-table adm-sources">
              <thead><tr><th>Date</th><th>Buyer</th><th>Product</th><th>Term</th><th>Amount</th><th>Source</th></tr></thead>
              <tbody>
                {recent.map((s, i) => {
                  const term = termOf(s)
                  return (
                    <tr key={`${s.created_at}-${i}`}>
                      <td>{fmtShort(s.created_at)}</td>
                      <td>{s.email}</td>
                      <td>{TIER_SHORT_LABEL[normalizeTier(s.tier)] ?? s.tier}</td>
                      <td className="admin-muted">{term === 'other' ? 'Other' : `${term} days`}</td>
                      <td>{fmtMoney(s.amount_cents)}</td>
                      <td className="admin-muted">{s.utm_source ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
