import { NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/picks/admin-auth'
import { cleanPicks, type DraftParsed } from '@/lib/picks/drafts'
import { parsePost } from '@/lib/picks/parse'

export const dynamic = 'force-dynamic'

/**
 * Save Ed's corrections to a draft without approving it, re-run the parser, or
 * move a skipped / rejected post back into the queue.
 *
 * Body: { picks?, note?, reparse?: true, status?: 'pending' }
 *
 * An approved draft is frozen: its picks are already rows in todays_bets, and
 * editing the draft afterwards would make it disagree with what was published.
 * Correct those in the picks editor instead.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: draft, error: readError } = await auth.admin.from('pick_drafts').select('*').eq('id', params.id).maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  if (draft.status === 'approved') return NextResponse.json({ error: 'Already approved; edit the published pick instead.' }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  let parsed: DraftParsed = { ...(draft.parsed ?? {}), picks: draft.parsed?.picks ?? [] }

  if (body?.reparse === true) {
    parsed = { ...parsed, ...(await parsePost(draft.post_text)) }
  }
  if (Array.isArray(body?.picks)) parsed.picks = cleanPicks(body.picks)
  if ('note' in (body ?? {})) parsed.note = body.note ? String(body.note).slice(0, 2000) : null

  const update: Record<string, unknown> = { parsed }
  if (body?.status === 'pending') update.status = 'pending'

  const { data, error } = await auth.admin.from('pick_drafts').update(update).eq('id', params.id).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ draft: data })
}
