import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await (admin as any).from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const now = new Date()
  const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [totalRes, monthRes, todayRes, recentRes] = await Promise.all([
    (admin as any).from('page_views').select('*', { count: 'exact', head: true }),
    (admin as any).from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
    (admin as any).from('page_views').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    (admin as any).from('page_views').select('path, created_at').gte('created_at', thirtyDaysAgo),
  ])

  const rows: { path: string; created_at: string }[] = recentRes.data ?? []

  // Build daily counts for last 30 days (including today)
  const dailyMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dailyMap[d.toISOString().slice(0, 10)] = 0
  }
  for (const row of rows) {
    const key = row.created_at.slice(0, 10)
    if (key in dailyMap) dailyMap[key]++
  }
  const daily = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

  // Top pages from last 30 days
  const pathCounts: Record<string, number> = {}
  for (const row of rows) {
    pathCounts[row.path] = (pathCounts[row.path] || 0) + 1
  }
  const topPages = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }))

  return NextResponse.json({
    totalViews:      totalRes.count ?? 0,
    viewsThisMonth:  monthRes.count ?? 0,
    viewsToday:      todayRes.count ?? 0,
    daily,
    topPages,
  })
}
