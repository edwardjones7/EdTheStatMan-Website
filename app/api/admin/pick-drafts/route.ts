import { NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/picks/admin-auth'
import { createDraft } from '@/lib/picks/drafts'
import { hasPickDrafts, MIGRATION_MISSING } from '@/lib/picks/columns'
import { xConfigured } from '@/lib/x'

export const dynamic = 'force-dynamic'

const STATUSES = ['pending', 'approved', 'rejected', 'skipped'] as const

/**
 * The queue. Always answers with what is configured, so the tab can show "X
 * not configured" or "migration missing" instead of an empty list that looks
 * like there is simply nothing to review.
 */
export async function GET(req: Request) {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const config = {
    x: xConfigured(),
    ai: !!process.env.AI_GATEWAY_API_KEY,
    model: process.env.PICKS_PARSER_MODEL || 'anthropic/claude-haiku-4.5',
    migrated: await hasPickDrafts(auth.admin),
  }
  if (!config.migrated) return NextResponse.json({ config, drafts: [], counts: {}, error: MIGRATION_MISSING })

  const url = new URL(req.url)
  const requested = url.searchParams.get('status') ?? 'pending'
  const status = (STATUSES as readonly string[]).includes(requested) ? requested : 'pending'

  const [{ data, error }, ...countResults] = await Promise.all([
    auth.admin
      .from('pick_drafts')
      .select('*')
      .eq('status', status)
      // The queue reads oldest first, the order Ed posted; the history tabs
      // read newest first, which is the one you are looking for.
      .order('posted_at', { ascending: status === 'pending', nullsFirst: false })
      .limit(100),
    ...STATUSES.map(s => auth.admin.from('pick_drafts').select('id', { count: 'exact', head: true }).eq('status', s)),
  ])
  if (error) return NextResponse.json({ config, drafts: [], counts: {}, error: error.message }, { status: 500 })

  const counts = Object.fromEntries(STATUSES.map((s, i) => [s, countResults[i]?.count ?? 0]))
  return NextResponse.json({ config, drafts: data ?? [], counts })
}

/**
 * Paste a post. The way to use the engine without X credentials, and the way
 * to catch a post the ingest missed. A pasted x.com URL contributes its status
 * id, so the cron recognises the same post later and does not queue it twice.
 */
export async function POST(req: Request) {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!(await hasPickDrafts(auth.admin))) return NextResponse.json({ error: MIGRATION_MISSING }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const postedAt = body?.postedAt && !Number.isNaN(Date.parse(body.postedAt)) ? new Date(body.postedAt).toISOString() : null
  const { draft, duplicate, error } = await createDraft(auth.admin, {
    text: String(body?.text ?? ''),
    url: body?.url ? String(body.url).trim() : null,
    postedAt,
    via: 'paste',
  })
  if (error) return NextResponse.json({ error }, { status: 400 })
  return NextResponse.json({ draft, duplicate }, { status: duplicate ? 200 : 201 })
}
