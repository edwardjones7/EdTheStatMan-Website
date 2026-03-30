import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

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
  const DAY = 24 * 60 * 60 * 1000

  function toNYDate(date: Date): string {
    return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  }

  const todayNY = toNYDate(now)

  // For week range, use a specific weekStart date (YYYY-MM-DD); default = 6 days ago
  const weekStartParam = searchParams.get('weekStart')
  const weekStartMs = range === 'week' && weekStartParam
    ? new Date(weekStartParam + 'T12:00:00').getTime()
    : now.getTime() - 6 * DAY
  const weekEndMs = weekStartMs + 7 * DAY

  let sinceDate: Date
  let windowEnd: Date | null = null

  if (range === 'week') {
    sinceDate = new Date(weekStartMs - DAY)   // 1-day buffer for NY timezone
    windowEnd = new Date(weekEndMs + DAY)      // 1-day buffer on the upper end
  } else if (range === 'year') {
    sinceDate = new Date(now.getTime() - 366 * DAY)
  } else {
    sinceDate = new Date(now.getTime() - 31 * DAY)
  }

  const baseCountQuery = (admin as any)
    .from('page_views')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sinceDate.toISOString())

  const rangeQuery = windowEnd ? baseCountQuery.lte('created_at', windowEnd.toISOString()) : baseCountQuery

  // Paginate rows to bypass Supabase project-level 1000-row cap
  async function fetchAllRows() {
    const PAGE = 1000
    let allRows: { path: string; created_at: string; referrer: string | null; device_type: string | null; country: string | null }[] = []
    let from = 0
    while (true) {
      let q = (admin as any)
        .from('page_views')
        .select('path, created_at, referrer, device_type, country')
        .gte('created_at', sinceDate.toISOString())
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (windowEnd) q = q.lte('created_at', windowEnd.toISOString())
      const { data, error } = await q
      if (error || !data || data.length === 0) break
      allRows = allRows.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }
    return allRows
  }

  const [totalRes, rangeRes, rows, signupsRes, totalUsersRes, paidUsersRes] = await Promise.all([
    (admin as any).from('page_views').select('*', { count: 'exact', head: true }),
    rangeQuery,
    fetchAllRows(),
    (admin as any).from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sinceDate.toISOString()),
    (admin as any).from('profiles').select('*', { count: 'exact', head: true }),
    (admin as any).from('profiles').select('*', { count: 'exact', head: true })
      .in('subscription_tier', ['basic', 'premium'])
      .gt('access_expires_at', new Date().toISOString()),
  ])


  // viewsToday only meaningful when today falls within the selected week window
  const viewsToday = (range !== 'week' || (now.getTime() >= weekStartMs && now.getTime() <= weekEndMs))
    ? rows.filter(r => toNYDate(new Date(r.created_at)) === todayNY).length
    : 0

  // Build chart points
  let points: { label: string; count: number }[]

  if (range === 'year') {
    const nowMs = now.getTime()
    const week = 7 * DAY
    const buckets = Array.from({ length: 52 }, (_, i) => {
      const weeksAgo = 51 - i
      const bucketStart = nowMs - (weeksAgo + 1) * week
      const bucketEnd   = nowMs - weeksAgo * week
      const label = new Date(bucketStart).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })
      return { label, bucketStart, bucketEnd, count: 0 }
    })

    for (const row of rows) {
      const t = new Date(row.created_at).getTime()
      for (const b of buckets) {
        if (t >= b.bucketStart && t < b.bucketEnd) { b.count++; break }
      }
    }

    points = buckets.map(b => ({ label: b.label, count: b.count }))
  } else {
    // Daily buckets — for week range anchor to weekStart, otherwise to now
    const days = range === 'week' ? 7 : 30
    const dailyMap: Record<string, number> = {}
    for (let i = 0; i < days; i++) {
      const d = range === 'week'
        ? new Date(weekStartMs + i * DAY)
        : new Date(now.getTime() - (days - 1 - i) * DAY)
      dailyMap[toNYDate(d)] = 0
    }
    for (const row of rows) {
      const key = toNYDate(new Date(row.created_at))
      if (key in dailyMap) dailyMap[key]++
    }
    points = Object.entries(dailyMap).map(([nyDate, count]) => ({
      label: new Date(nyDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    }))
  }

  // Top pages
  const pathCounts: Record<string, number> = {}
  for (const row of rows) pathCounts[row.path] = (pathCounts[row.path] || 0) + 1
  const topPages = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, count]) => ({ path, count }))

  // Referrers
  const referrerCounts: Record<string, number> = {}
  for (const row of rows) {
    if (!row.referrer) continue
    let domain = row.referrer
    try { domain = new URL(row.referrer).hostname.replace(/^www\./, '') } catch {}
    if (domain) referrerCounts[domain] = (referrerCounts[domain] || 0) + 1
  }
  const referrers = Object.entries(referrerCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([source, count]) => ({ source, count }))

  // Devices
  const deviceCounts: Record<string, number> = {}
  for (const row of rows) {
    if (!row.device_type) continue
    deviceCounts[row.device_type] = (deviceCounts[row.device_type] || 0) + 1
  }
  const devices = Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]).map(([device, count]) => ({ device, count }))

  // Countries
  const countryCounts: Record<string, number> = {}
  for (const row of rows) {
    if (!row.country) continue
    countryCounts[row.country] = (countryCounts[row.country] || 0) + 1
  }
  const countries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([country, count]) => ({ country, count }))

  const totalUsers = totalUsersRes.count ?? 0
  const paidUsers  = paidUsersRes.count ?? 0

  return NextResponse.json({
    totalViews:   totalRes.count ?? 0,
    viewsInRange: rangeRes.count ?? 0,
    viewsToday,
    points,
    topPages,
    referrers,
    devices,
    countries,
    newSignups: signupsRes.count ?? 0,
    totalUsers,
    paidUsers,
  })
}
