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
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  let sinceDate: Date
  if (range === 'week') {
    sinceDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else if (range === 'year') {
    sinceDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  } else {
    sinceDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  const [totalRes, rangeRes, todayRes, rowsRes] = await Promise.all([
    (admin as any).from('page_views').select('*', { count: 'exact', head: true }),
    (admin as any).from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', sinceDate.toISOString()),
    (admin as any).from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    (admin as any).from('page_views').select('path, created_at').gte('created_at', sinceDate.toISOString()),
  ])

  const rows: { path: string; created_at: string }[] = rowsRes.data ?? []

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
      const label = new Date(bucketStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
    // Daily buckets (7 or 30 days)
    const days = range === 'week' ? 7 : 30
    const dailyMap: Record<string, number> = {}
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      dailyMap[d.toISOString().slice(0, 10)] = 0
    }
    for (const row of rows) {
      const key = row.created_at.slice(0, 10)
      if (key in dailyMap) dailyMap[key]++
    }
    points = Object.entries(dailyMap).map(([date, count]) => ({
      label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
    viewsToday:   todayRes.count ?? 0,
    points,
    topPages,
  })
}
