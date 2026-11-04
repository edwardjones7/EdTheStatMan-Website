import { NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/picks/admin-auth'
import { exportRows, parseAudienceFilter, toCsv } from '@/lib/admin-people'
import { loadPeople } from '@/lib/admin-people-server'

export const dynamic = 'force-dynamic'

/**
 * The email list as a CSV. Admin is checked BEFORE anything is read, unlike the
 * analytics routes, which overlap the two and throw the result away: this one
 * reads every address on the site, so a non-admin should not trigger it at all.
 *
 * A failed read answers 500 rather than a short file. A list that is quietly
 * missing people looks exactly like a complete one.
 */
export async function GET(req: Request) {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const filter = parseAudienceFilter(new URL(req.url).searchParams.get('filter'))
  if (!filter) return NextResponse.json({ error: 'Unknown filter' }, { status: 400 })

  const { people, error } = await loadPeople(auth.admin)
  if (error) return NextResponse.json({ error: 'Could not load the list' }, { status: 500 })

  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(toCsv(exportRows(people, filter)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="edthestatman-${filter}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
