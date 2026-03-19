import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // All date bucketing uses America/New_York so views after 7 PM EST don't
  // bleed into the next calendar day.
  function toNYDate(date: Date): string {
    // Returns 'YYYY-MM-DD' in America/New_York timezone
    return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  }

  const todayNY = toNYDate(now)

  let sinceDate: Date
  if (range === 'week') {
    // Go back 8 days in UTC to ensure we capture all NY-date rows for the last 7 NY days
    sinceDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
  } else if (range === 'year') {
    sinceDate = new Date(now.getTime() - 366 * 24 * 60 * 60 * 1000)
  } else {
    sinceDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
  }

  const [totalRes, rangeRes, rowsRes] = await Promise.all([
    (admin as any).from('page_views').select('*', { count: 'exact', head: true }),
    (admin as any).from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', sinceDate.toISOString()),
    (admin as any).from('page_views').select('path, created_at').gte('created_at', sinceDate.toISOString()),
  ])

  const rows: { path: string; created_at: string }[] = rowsRes.data ?? []

  // Compute today's count from rows using NY date — same logic as the chart buckets
  const viewsToday = rows.filter(r => toNYDate(new Date(r.created_at)) === todayNY).length

  // Build chart points
  let points: { label: string; count: number }[]

  if (range === 'year') {
    // 52 weekly buckets — bucket[51] = most recent week, bucket[0] = oldest
    const nowMs = now.getTime()
    const week = 7 * 24 * 60 * 60 * 1000
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
        if (t >= b.bucketStart && t < b.bucketEnd) {
          b.count++
          break
        }
      }
    }

    points = buckets.map(b => ({ label: b.label, count: b.count }))
  } else {
    // Daily buckets using NY dates (7 or 30 days)
    const days = range === 'week' ? 7 : 30
    const dailyMap: Record<string, number> = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
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

  // Top pages in range
  const pathCounts: Record<string, number> = {}
  for (const row of rows) {
    pathCounts[row.path] = (pathCounts[row.path] || 0) + 1
  }
  const topPages = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }))

  return NextResponse.json({
    totalViews:   totalRes.count ?? 0,
    viewsInRange: rangeRes.count ?? 0,
    viewsToday,
    points,
    topPages,
  })
}
