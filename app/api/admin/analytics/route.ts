import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toNYDate, nyMidnightUTC } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

function addDays(dateStr: string, days: number): string {
  return toNYDate(new Date(new Date(`${dateStr}T12:00:00Z`).getTime() + days * DAY))
}

function shortLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export async function GET(request: Request) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await (admin as any).from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const range = searchParams.get('range') ?? 'month' // 'week' | 'month' | 'year'

  const now = new Date()
  const todayNY = toNYDate(now)

  // Window boundaries (all NY-midnight aligned) + expected chart bucket dates
  let from: Date
  let to: Date
  let bucket: 'day' | 'week'
  let expectedBuckets: string[]

  if (range === 'week') {
    const weekStart = searchParams.get('weekStart') ?? addDays(todayNY, -6)
    from = nyMidnightUTC(weekStart)
    to = nyMidnightUTC(addDays(weekStart, 7))
    bucket = 'day'
    expectedBuckets = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  } else if (range === 'year') {
    // 52 ISO weeks; date_trunc('week') buckets start on Mondays
    const todayNoon = new Date(`${todayNY}T12:00:00Z`)
    const dow = todayNoon.getUTCDay() // 0=Sun
    const thisMonday = addDays(todayNY, dow === 0 ? -6 : 1 - dow)
    const firstMonday = addDays(thisMonday, -51 * 7)
    from = nyMidnightUTC(firstMonday)
    to = now
    bucket = 'week'
    expectedBuckets = Array.from({ length: 52 }, (_, i) => addDays(firstMonday, i * 7))
  } else {
    const firstDay = addDays(todayNY, -29)
    from = nyMidnightUTC(firstDay)
    to = now
    bucket = 'day'
    expectedBuckets = Array.from({ length: 30 }, (_, i) => addDays(firstDay, i))
  }

  const fromISO = from.toISOString()
  const toISO = to.toISOString()
  const todayStartISO = nyMidnightUTC(todayNY).toISOString()

  const a = admin as any
  const [
    totalRes, rangeRes, todayRes,
    seriesRes, summaryRes,
    pagesRes, referrersRes, devicesRes, countriesRes, utmRes,
    winVisitorsRes, checkoutClicksRes,
    purchasesRes, allPurchasesRes,
    signupsRes, totalUsersRes, paidUsersRes,
  ] = await Promise.all([
    a.from('page_views').select('*', { count: 'exact', head: true }),
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
    a.from('purchases').select('amount_cents'),
    a.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', fromISO),
    a.from('profiles').select('*', { count: 'exact', head: true }),
    a.from('profiles').select('*', { count: 'exact', head: true })
      .in('subscription_tier', ['basic', 'premium', 'elite'])
      .gt('access_expires_at', now.toISOString()),
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

  type Breakdown = { label: string; count: number }[]
  const asRows = (res: any): Breakdown => ((res.data ?? []) as Breakdown).map(r => ({ label: r.label, count: Number(r.count) }))

  // Revenue
  const rangePurchases = (purchasesRes.data ?? []) as { amount_cents: number; tier: string }[]
  const revenueInRange = rangePurchases.reduce((sum, p) => sum + p.amount_cents, 0)
  const revenueByTier: Record<string, number> = {}
  for (const p of rangePurchases) revenueByTier[p.tier] = (revenueByTier[p.tier] ?? 0) + p.amount_cents
  const revenueTotal = ((allPurchasesRes.data ?? []) as { amount_cents: number }[])
    .reduce((sum, p) => sum + p.amount_cents, 0)

  // viewsToday only meaningful when today falls inside the selected window
  const todayInWindow = range !== 'week' || (now >= from && now < to)

  return NextResponse.json({
    totalViews:   totalRes.count ?? 0,
    viewsInRange: rangeRes.count ?? 0,
    viewsToday:   todayInWindow ? (todayRes.count ?? 0) : 0,
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
    revenueTotal,
    purchaseCount: rangePurchases.length,
    revenueByTier,
    funnel: {
      winVisitors:    Number(winVisitorsRes.data ?? 0),
      checkoutClicks: checkoutClicksRes.count ?? 0,
      purchases:      rangePurchases.length,
    },
    newSignups: signupsRes.count ?? 0,
    totalUsers: totalUsersRes.count ?? 0,
    paidUsers:  paidUsersRes.count ?? 0,
  })
}
