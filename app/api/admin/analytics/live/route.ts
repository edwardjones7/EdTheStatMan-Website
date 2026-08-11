import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { toNYDate, nyMidnightUTC } from '@/lib/analytics'

export const dynamic = 'force-dynamic'

// Lightweight endpoint the admin dashboard polls every 30s. Three cheap
// index-backed queries — safe to hit continuously.
export async function GET() {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient() as any
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const todayStart = nyMidnightUTC(toNYDate(new Date()))

  const [activeRes, viewsRes, purchasesRes] = await Promise.all([
    admin.rpc('active_visitors'),
    admin.from('page_views').select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString()),
    admin.from('purchases').select('amount_cents')
      .gte('created_at', todayStart.toISOString()),
  ])

  const revenueToday = ((purchasesRes.data ?? []) as { amount_cents: number }[])
    .reduce((sum, p) => sum + p.amount_cents, 0)

  return NextResponse.json({
    activeNow:    Number(activeRes.data ?? 0),
    viewsToday:   viewsRes.count ?? 0,
    revenueToday,
  })
}
