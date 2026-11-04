// Admin analytics queries, shared by the /api/admin/analytics route and the
// /admin server component (which prerenders the first payload so the dashboard
// paints with data instead of hydrate-then-fetch).
//
// Split into two halves on purpose:
//   getRangeAnalytics — everything scoped to the selected window; refetched on
//                       every range switch.
//   getGlobalTotals   — all-time figures that never change with the range, so
//                       the client fetches them once and reuses them.
//
// Traffic only. Signups, revenue and everything else about people comes from
// lib/admin-people.ts, which the dashboard already holds in full, so it can be
// sliced to any window without another round trip.
import { toNYDate, nyMidnightUTC } from '@/lib/analytics'

const DAY = 24 * 60 * 60 * 1000

export type Range = 'week' | 'month' | 'year'

export interface FunnelStep { key: string; label: string; count: number }

export interface RangeAnalytics {
  /** The selected window and the same length before it, for comparisons. */
  window: { from: string; to: string; prevFrom: string; prevTo: string }
  viewsInRange: number
  prevViews: number
  points: { date: string; label: string; count: number; visitors: number }[]
  topPages: { path: string; count: number }[]
  referrers: { source: string; count: number }[]
  devices: { device: string; count: number }[]
  countries: { country: string; count: number }[]
  utmSources: { source: string; count: number }[]
  /** Null until analytics_sources() exists. */
  sources: { source: string; views: number; visitors: number }[] | null
  uniqueVisitors: number
  sessions: number
  bounceRate: number
  avgSessionSecs: number
  funnel: FunnelStep[]
  /** Which reads failed. A name here means the figure is unknown, not zero. */
  failed: string[]
}

export interface GlobalTotals {
  totalViews: number
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

/** The funnel events shown, top to bottom. Every one is counted in people. */
const FUNNEL_STEPS: { key: string; label: string }[] = [
  { key: 'paywall_view',     label: 'Hit a paywall' },
  { key: 'signup_start',     label: 'Started signup' },
  { key: 'signup_complete',  label: 'Finished signup' },
  { key: 'trial_started',    label: 'Started trial' },
  { key: 'checkout_click',   label: 'Clicked buy' },
  { key: 'checkout_started', label: 'Reached Stripe' },
  { key: 'purchase',         label: 'Purchased' },
]

const EVENT_PAGE = 1000

type EventRow = { id: number; event_type: string; user_id: string | null; visitor_id: string | null }

async function loadFunnelEvents(a: any, fromISO: string, toISO: string): Promise<EventRow[]> {
  const rows: EventRow[] = []
  for (let from = 0; ; from += EVENT_PAGE) {
    const { data, error } = await a.from('events')
      .select('id, event_type, user_id, visitor_id')
      .in('event_type', FUNNEL_STEPS.map(s => s.key))
      .gte('created_at', fromISO).lt('created_at', toISO)
      .order('id')
      .range(from, from + EVENT_PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...((data ?? []) as EventRow[]))
    if (!data || data.length < EVENT_PAGE) return rows
  }
}

/** One person per step however many times they fired it. */
function countPeople(rows: EventRow[], key: string): number {
  const seen = new Set<string>()
  for (const r of rows) {
    if (r.event_type === key) seen.add(r.user_id ?? r.visitor_id ?? `row:${r.id}`)
  }
  return seen.size
}

export async function getRangeAnalytics(
  admin: any,
  range: Range,
  weekStart: string | null = null,
  now = new Date(),
): Promise<RangeAnalytics> {
  const { from, to, bucket, expectedBuckets } = resolveWindow(range, weekStart, now)
  const fromISO = from.toISOString()
  const toISO = to.toISOString()
  const prevFromISO = new Date(from.getTime() - (to.getTime() - from.getTime())).toISOString()

  const a = admin
  const [
    rangeRes, prevViewsRes,
    seriesRes, summaryRes,
    pagesRes, referrersRes, devicesRes, countriesRes, utmRes,
    winVisitorsRes, sourcesRes, eventsRes,
  ] = await Promise.all([
    a.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', fromISO).lt('created_at', toISO),
    a.from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', prevFromISO).lt('created_at', fromISO),
    a.rpc('analytics_timeseries', { p_from: fromISO, p_to: toISO, p_bucket: bucket }),
    a.rpc('analytics_summary', { p_from: fromISO, p_to: toISO }),
    a.rpc('analytics_breakdown', { p_from: fromISO, p_to: toISO, p_dim: 'path', p_limit: 10 }),
    a.rpc('analytics_breakdown', { p_from: fromISO, p_to: toISO, p_dim: 'referrer', p_limit: 10 }),
    a.rpc('analytics_breakdown', { p_from: fromISO, p_to: toISO, p_dim: 'device', p_limit: 10 }),
    a.rpc('analytics_breakdown', { p_from: fromISO, p_to: toISO, p_dim: 'country', p_limit: 10 }),
    a.rpc('analytics_breakdown', { p_from: fromISO, p_to: toISO, p_dim: 'utm_source', p_limit: 10 }),
    a.rpc('analytics_path_visitors', { p_from: fromISO, p_to: toISO, p_path: '/win' }),
    a.rpc('analytics_sources', { p_from: fromISO, p_to: toISO }),
    loadFunnelEvents(a, fromISO, toISO).then(
      rows => ({ rows, error: null as Error | null }),
      (error: Error) => ({ rows: [] as EventRow[], error }),
    ),
  ])

  // Every read is checked. These used to fall through `?? 0`, so a broken
  // database rendered as a quiet day. analytics_sources is left out: it is
  // expected to be missing until the migration runs, and null says so.
  const failed = Object.entries({
    views: rangeRes, prevViews: prevViewsRes, chart: seriesRes, summary: summaryRes,
    pages: pagesRes, referrers: referrersRes, devices: devicesRes, countries: countriesRes,
    campaigns: utmRes, funnel: eventsRes, win: winVisitorsRes,
  }).filter(([, res]) => (res as { error: unknown }).error).map(([name]) => name)
  if (failed.length) console.error(`[admin-analytics] failed reads: ${failed.join(', ')}`)

  // Chart points: zero-fill the expected buckets over the RPC results
  const seriesMap = new Map<string, { views: number; visitors: number }>(
    ((seriesRes.data ?? []) as { bucket: string; views: number; visitors: number }[])
      .map(r => [r.bucket, { views: Number(r.views), visitors: Number(r.visitors) }])
  )
  const points = expectedBuckets.map(dateStr => {
    const row = seriesMap.get(dateStr)
    return { date: dateStr, label: shortLabel(dateStr), count: row?.views ?? 0, visitors: row?.visitors ?? 0 }
  })

  const summary = (summaryRes.data ?? {}) as {
    unique_visitors?: number; sessions?: number; bounce_rate?: number; avg_session_s?: number
  }
  const uniqueVisitors = Number(summary.unique_visitors ?? 0)

  return {
    window: { from: fromISO, to: toISO, prevFrom: prevFromISO, prevTo: fromISO },
    viewsInRange: rangeRes.count ?? 0,
    prevViews: prevViewsRes.count ?? 0,
    points,
    topPages:  asRows(pagesRes).map(r => ({ path: r.label, count: r.count })),
    referrers: asRows(referrersRes).map(r => ({ source: r.label, count: r.count })),
    devices:   asRows(devicesRes).map(r => ({ device: r.label, count: r.count })),
    countries: asRows(countriesRes).map(r => ({ country: r.label, count: r.count })),
    utmSources: asRows(utmRes).map(r => ({ source: r.label, count: r.count })),
    sources: sourcesRes.error
      ? null
      : ((sourcesRes.data ?? []) as { source: string; views: number; visitors: number }[])
          .map(r => ({ source: r.source, views: Number(r.views), visitors: Number(r.visitors) })),
    uniqueVisitors,
    sessions:       Number(summary.sessions ?? 0),
    bounceRate:     Number(summary.bounce_rate ?? 0),
    avgSessionSecs: Number(summary.avg_session_s ?? 0),
    funnel: [
      { key: 'visitors', label: 'Visited the site', count: uniqueVisitors },
      { key: 'win', label: 'Saw /win', count: Number(winVisitorsRes.data ?? 0) },
      ...FUNNEL_STEPS.map(s => ({ ...s, count: countPeople(eventsRes.rows, s.key) })),
    ],
    failed,
  }
}

// All-time figures — independent of the selected range, so they are fetched
// once per dashboard session rather than on every range switch.
export async function getGlobalTotals(admin: any): Promise<GlobalTotals> {
  const { count } = await admin.from('page_views').select('*', { count: 'exact', head: true })
  return { totalViews: count ?? 0 }
}
