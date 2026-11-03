import { NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/picks/admin-auth'

export const dynamic = 'force-dynamic'

/**
 * Not a pick, or not one Ed wants on the site. Kept rather than deleted, so
 * the ingest never queues the post again and the decision can be undone from
 * the Rejected filter.
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await auth.admin
    .from('pick_drafts')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', params.id)
    .neq('status', 'approved')
    .select('*')
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Draft not found, or already approved.' }, { status: 409 })
  return NextResponse.json({ draft: data })
}
