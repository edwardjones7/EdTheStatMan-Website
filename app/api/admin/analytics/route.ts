import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRangeAnalytics, getGlobalTotals, parseRange } from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const range = parseRange(searchParams.get('range'))
  const weekStart = searchParams.get('weekStart')
  // Client already holds the all-time figures after the first load and asks us
  // to skip them (`totals=0`) — they don't change with the selected range.
  const wantTotals = searchParams.get('totals') !== '0'

  const admin = createAdminClient()
  const a = admin as any

  // The is_admin lookup is its own round trip, so fire it alongside the data
  // queries instead of before them. Nothing is returned until it comes back
  // true — a non-admin still gets a 403 and the results are thrown away.
  const isAdminPromise = a.from('profiles').select('is_admin').eq('id', user.id).single()
  const dataPromise = Promise.all([
    getRangeAnalytics(a, range, weekStart),
    wantTotals ? getGlobalTotals(a) : Promise.resolve(null),
  ])
  dataPromise.catch(() => {}) // don't leave a rejection unhandled if we 403 below

  const { data: profile } = await isAdminPromise
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [rangeData, totals] = await dataPromise

  return NextResponse.json({ ...rangeData, ...(totals ?? {}) })
}
