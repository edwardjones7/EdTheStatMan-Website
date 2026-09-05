// Admin analytics queries, shared by the /api/admin/analytics route and the
// /admin server component (which prerenders the first payload so the dashboard
// paints with data instead of hydrate-then-fetch).
//
// Split into two halves on purpose:
//   getRangeAnalytics — everything scoped to the selected window; refetched on
//                       every range switch.
//   getGlobalTotals   — all-time figures that never change with the range, so
//                       the client fetches them once and reuses them.
import { toNYDate, nyMidnightUTC } from '@/lib/analytics'
import { PAID_TIER_VALUES } from '@/lib/access'

const DAY = 24 * 60 * 60 * 1000

export type Range = 'week' | 'month' | 'year'

export interface RangeAnalytics {
  viewsInRange: number
  viewsToday: number
  points: { label: string; count: number; visitors: number }[]
  topPages: { path: string; count: number }[]
  referrers: { source: string; count: number }[]
  devices: { device: string; count: number }[]
  countries: { country: string; count: number }[]
  utmSources: { source: string; count: number }[]
  uniqueVisitors: number
  sessions: number
  bounceRate: number
  avgSessionSecs: number
  revenueInRange: number
  purchaseCount: number
  revenueByTier: Record<string, number>
  funnel: { winVisitors: number; checkoutClicks: number; purchases: number }
  newSignups: number
}

export interface GlobalTotals {
  totalViews: number
  revenueTotal: number
  totalUsers: number
  paidUsers: number
}

export type AnalyticsPayload = RangeAnalytics & Partial<GlobalTotals>

export function parseRange(value: string | null): Range {
  return value === 'week' || value === 'year' ? value : 'month'
}

function addDays(dateStr: string, days: number): string {
  return toNYDate(new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + days * DAY))
}

function shortLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function defaultWeekStart(now = new Date()): string {
  return addDays(toNYDate(now), -6)
}

// Window boundaries (all NY-midnight aligned) + the chart buckets we expect back.
function resolveWindow(range: Range, weekStart: string | null, now: Date) {
  const todayNY = toNYDate(now)

  if (range === 'week') {
    const start = weekStart ?? addDays(todayNY, -6)
    return {
      from: nyMidnightUTC(start),
      to: nyMidnightUTC(addDays(start, 7)),
      bucket: 'day' as const,
      expectedBuckets: Array.from({ length: 7 }, (_, i) => addDays(start, i)),
    }
  }

  if (range === 'year') {
    // 52 ISO weeks; date_trunc('week') buckets start on Mondays
    const todayNoon = new Date(`${todayNY}T12:00:00Z`)
    const dow = todayNoon.getUTCDay() // 0=Sun
    const thisMonday = addDays(todayNY, dow === 0 ? -6 : 1 - dow)
    const firstMonday = addDays(thisMonday, -51 * 7)
    return {
      from: nyMidnightUTC(firstMonday),
      to: now,
      bucket: 'week' as const,
      expectedBuckets: Array.from({ length: 52 }, (_, i) => addDays(firstMonday, i * 7)),
    }
  }

  const firstDay = addDays(todayNY, -29)
  return {
    from: nyMidnightUTC(firstDay),
    to: now,
    bucket: 'day' as const,
    expectedBuckets: Array.from({ length: 30 }, (_, i) => addDays(firstDay, i)),
  }
}

type Breakdown = { label: string; count: number }[]
const asRows = (res: any): Breakdown =>
  ((res?.data ?? []) as Breakdown).map(r => ({ label: r.label, count: Number(r.count) }))

export async function getRangeAnalytics(
  admin: any,
  range: Range,
  weekStart: string | null = null,
  now = new Date(),
): Promise<RangeAnalytics> {
  const { from, to, bucket, expectedBuckets } = resolveWindow(range, weekStart, now)
  const fromISO = from.toISOString()
  const toISO = to.toISOString()
  const todayStartISO = nyMidnightUTC(toNYDate(now)).toISOString()

  const a = admin
  const [
    rangeRes, todayRes,
    seriesRes, summaryRes,
    pagesRes, referrersRes, devicesRes, countriesRes, utmRes,
    winVisitorsRes, checkoutClicksRes,
    purchasesRes, signupsRes,
  ] = await Promise.all([
    a.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', fromISO).lt('created_at', toISO),
    a.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', todayStartISO),
    a.rpc('analytics_timeseries', { p_from: fromISO, p_to: toISO, p_bucket: bucket }),
    a.rpc('analytics_summary', { p_from: fromISO, p_to: toISO }),
    a.rpc('analytics_breakdown', { p_from: fromISO, p_to: toISO, p_dim: 'path', p_limit: 10 }),
    a.rpc('analytics_breakdown', { p_from: fromISO, p_to: toISO, p_dim: 'referrer', p_limit: 10 }),
    a.rpc('analytics_breakdown', { p_from: fromISO, p_to: toISO, p_dim: 'device', p_limit: 10 }),
    a.rpc('analytics_breakdown', { p_from: fromISO, p_to: toISO, p_dim: 'country', p_limit: 10 }),
    a.rpc('analytics_breakdown', { p_from: fromISO, p_to: toISO, p_dim: 'utm_source', p_limit: 10 }),
    a.rpc('analytics_path_visitors', { p_from: fromISO, p_to: toISO, p_path: '/win' }),
    a.from('events').select('*', { count: 'exact', head: true })
      .eq('event_type', 'checkout_click').gte('created_at', fromISO).lt('created_at', toISO),
    a.from('purchases').select('amount_cents, tier').gte('created_at', fromISO).lt('created_at', toISO),
    a.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', fromISO),
  ])

  // Chart points: zero-fill the expected buckets over the RPC results
  const seriesMap = new Map<string, { views: number; visitors: number }>(
    ((seriesRes.data ?? []) as { bucket: string; views: number; visitors: number }[])
      .map(r => [r.bucket, { views: Number(r.views), visitors: Number(r.visitors) }])
  )
  const points = expectedBuckets.map(dateStr => {
    const row = seriesMap.get(dateStr)
    return { label: shortLabel(dateStr), count: row?.views ?? 0, visitors: row?.visitors ?? 0 }
  })

  const summary = (summaryRes.data ?? {}) as {
    unique_visitors?: number; sessions?: number; bounce_rate?: number; avg_session_s?: number
  }

  const rangePurchases = (purchasesRes.data ?? []) as { amount_cents: number; tier: string }[]
  const revenueInRange = rangePurchases.reduce((sum, p) => sum + p.amount_cents, 0)
  const revenueByTier: Record<string, number> = {}
  for (const p of rangePurchases) revenueByTier[p.tier] = (revenueByTier[p.tier] ?? 0) + p.amount_cents

  // viewsToday only meaningful when today falls inside the selected window
  const todayInWindow = range !== 'week' || (now >= from && now < to)

  return {
    viewsInRange: rangeRes.count ?? 0,
    viewsToday: todayInWindow ? (todayRes.count ?? 0) : 0,
    points,
    topPages:  asRows(pagesRes).map(r => ({ path: r.label, count: r.count })),
    referrers: asRows(referrersRes).map(r => ({ source: r.label, count: r.count })),
    devices:   asRows(devicesRes).map(r => ({ device: r.label, count: r.count })),
    countries: asRows(countriesRes).map(r => ({ country: r.label, count: r.count })),
    utmSources: asRows(utmRes).map(r => ({ source: r.label, count: r.count })),
    uniqueVisitors: Number(summary.unique_visitors ?? 0),
    sessions:       Number(summary.sessions ?? 0),
    bounceRate:     Number(summary.bounce_rate ?? 0),
    avgSessionSecs: Number(summary.avg_session_s ?? 0),
    revenueInRange,
    purchaseCount: rangePurchases.length,
    revenueByTier,
    funnel: {
      winVisitors:    Number(winVisitorsRes.data ?? 0),
      checkoutClicks: checkoutClicksRes.count ?? 0,
      purchases:      rangePurchases.length,
    },
    newSignups: signupsRes.count ?? 0,
  }
}

// All-time figures — independent of the selected range, so they are fetched
// once per dashboard session rather than on every range switch.
export async function getGlobalTotals(admin: any, now = new Date()): Promise<GlobalTotals> {
  const a = admin
  const [totalViewsRes, allPurchasesRes, totalUsersRes, paidUsersRes] = await Promise.all([
    a.from('page_views').select('*', { count: 'exact', head: true }),
    a.from('purchases').select('amount_cents'),
    a.from('profiles').select('*', { count: 'exact', head: true }),
    a.from('profiles').select('*', { count: 'exact', head: true })
      .in('subscription_tier', PAID_TIER_VALUES)
      .gt('access_expires_at', now.toISOString()),
  ])

  return {
    totalViews: totalViewsRes.count ?? 0,
    revenueTotal: ((allPurchasesRes.data ?? []) as { amount_cents: number }[])
      .reduce((sum, p) => sum + p.amount_cents, 0),
    totalUsers: totalUsersRes.count ?? 0,
    paidUsers: paidUsersRes.count ?? 0,
  }
}
