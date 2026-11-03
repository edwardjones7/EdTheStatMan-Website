import { NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/picks/admin-auth'
import { ingestFromX } from '@/lib/picks/drafts'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** "Pull from X now": the cron's ingest, on demand, for an admin. */
export async function POST() {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return NextResponse.json(await ingestFromX(auth.admin))
}
