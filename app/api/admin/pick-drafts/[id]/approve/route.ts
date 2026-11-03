import { NextResponse } from 'next/server'
import { assertAdmin } from '@/lib/picks/admin-auth'
import { cleanPicks, draftToRows, pickAccessColumns, type DraftParsed } from '@/lib/picks/drafts'
import { hasPickEngineColumns, MIGRATION_MISSING } from '@/lib/picks/columns'
import { notifyNewPick } from '@/lib/notify'
import { gameIdPatch } from '@/lib/picks/game-match'
import { revalidatePublicPicks } from '@/lib/picks/revalidate'

export const dynamic = 'force-dynamic'
// Each pick is announced in turn (Discord, email, push); a four-pick post is
// four rounds of sends.
export const maxDuration = 60

/**
 * Publish a draft: its picks become todays_bets rows with a public page each.
 *
 * Body: { picks?, note?, min_tier? = 'retail', notify? = true }
 * The picks in the body are what Ed saw and corrected on the card; without
 * them, the stored parse is used.
 *
 * ONE TAP MUST NOT PUBLISH TWICE. A phone double-tap, or two open tabs, would
 * otherwise insert every pick twice. The draft is claimed first, with an update
 * that only matches while it still holds the status we read, so exactly one
 * request wins; if the insert then fails the claim is released.
 *
 * Announcing follows the rule app/api/admin/todays-bets applies to every new
 * pick (fire on insert, Eddie's explicit choice), and the same opt-out:
 * notify:false saves silently. Awaited, not fire-and-forget, because Vercel can
 * freeze the function once the response is sent. notifyNewPick never throws.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await assertAdmin()
  if (!auth.ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = auth.admin

  if (!(await hasPickEngineColumns(admin))) return NextResponse.json({ error: MIGRATION_MISSING }, { status: 409 })

  const body = await req.json().catch(() => ({}))
  const access = pickAccessColumns(body?.min_tier)
  if ('error' in access) return NextResponse.json({ error: access.error }, { status: 400 })

  const { data: draft, error: readError } = await admin.from('pick_drafts').select('*').eq('id', params.id).maybeSingle()
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  if (draft.status === 'approved') return NextResponse.json({ error: 'Already approved.' }, { status: 409 })

  const stored: DraftParsed = draft.parsed ?? { picks: [] }
  const picks = cleanPicks(Array.isArray(body?.picks) ? body.picks : stored.picks)
  if (picks.length === 0) return NextResponse.json({ error: 'No picks to publish. Add one, or reject the post.' }, { status: 400 })
  const note = 'note' in (body ?? {}) ? (body.note ? String(body.note).slice(0, 2000) : null) : stored.note ?? null

  const reviewedAt = new Date().toISOString()
  const { data: claimed, error: claimError } = await admin
    .from('pick_drafts')
    .update({ status: 'approved', reviewed_at: reviewedAt, parsed: { ...stored, picks, note } })
    .eq('id', params.id)
    .eq('status', draft.status)
    .select('id')
    .maybeSingle()
  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })
  if (!claimed) return NextResponse.json({ error: 'Already handled in another tab.' }, { status: 409 })

  // Each pick onto its Desk game, when one fits (lib/picks/game-match.ts).
  const rows = await Promise.all(
    draftToRows(draft, picks, { access, note }).map(async (row: any) => ({
      ...row,
      ...(await gameIdPatch(admin, {}, { sport: row.sport ?? null, date: row.date ?? null, bet: row.bet ?? null, opponent: row.opponent ?? null })),
    })),
  )
  const { data: inserted, error: insertError } = await admin.from('todays_bets').insert(rows).select()
  if (insertError) {
    await admin.from('pick_drafts').update({ status: draft.status, reviewed_at: null }).eq('id', params.id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const ids = (inserted ?? []).map((r: any) => r.id)
  await admin.from('pick_drafts').update({ pick_ids: ids }).eq('id', params.id)

  const notified = []
  if (body?.notify !== false) {
    for (const row of inserted ?? []) notified.push(await notifyNewPick(row))
  }

  // /picks is cached; a new pick should be on it now, not in a few minutes.
  revalidatePublicPicks()

  return NextResponse.json({ ok: true, picks: inserted, notified }, { status: 201 })
}
