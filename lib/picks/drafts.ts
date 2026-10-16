/**
 * The review queue: X post -> pick_drafts row -> (Ed approves) -> todays_bets.
 *
 * The cron (app/api/cron/x-ingest), the admin "Pull from X" button and the
 * admin paste box all land here, so a post is parsed and stored one way no
 * matter how it arrived.
 *
 * NOTHING HERE PUBLISHES. Drafts sit in a service-role-only table until
 * approveDraft() runs, which only an admin route calls.
 */

import { fetchRecentPosts, xConfigured, xPostIdFromUrl, compareIds } from '@/lib/x'
import { nyToday } from '@/lib/brief'
import { TIER_RANK, normalizeTier, type Tier } from '@/lib/access'
import { parsePost, normalizePick, type ParsedPick, type ParseResult } from './parse'
import { pickSlug, formatOdds } from './slug'
import { hasPickDrafts, MIGRATION_MISSING } from './columns'

export type DraftStatus = 'pending' | 'approved' | 'rejected' | 'skipped'

export interface DraftParsed extends Partial<ParseResult> {
  picks: ParsedPick[]
  /** Ed's blurb for the pick page, editable in the queue. */
  note?: string | null
  /** How the post arrived. Only 'x' rows move the ingest's since_id. */
  via?: 'x' | 'paste'
}

export interface PickDraft {
  id: string
  x_post_id: string | null
  post_text: string
  post_url: string | null
  posted_at: string | null
  parsed: DraftParsed
  status: DraftStatus
  pick_ids: string[] | null
  created_at: string
  reviewed_at: string | null
}

/** Cap per run, so one backlog cannot run a function past its limit or the AI bill up. */
const MAX_PER_RUN = 25

/**
 * Parse a post and queue it. A post with no pick in it is kept as `skipped`
 * rather than dropped: the ingest's since_id moves past it either way, and Ed
 * can still find and approve it if the parser missed a real pick.
 *
 * Returns null without inserting when the post is already queued.
 */
export async function createDraft(
  admin: any,
  post: { text: string; url?: string | null; postedAt?: string | null; xPostId?: string | null; via: 'x' | 'paste' }
): Promise<{ draft: PickDraft | null; duplicate: boolean; error?: string }> {
  const text = String(post.text ?? '').trim()
  if (!text) return { draft: null, duplicate: false, error: 'Post text is empty.' }

  const xPostId = post.xPostId ?? xPostIdFromUrl(post.url)
  if (xPostId) {
    const { data: existing } = await admin.from('pick_drafts').select('*').eq('x_post_id', xPostId).maybeSingle()
    if (existing) return { draft: existing as PickDraft, duplicate: true }
  }

  const result = await parsePost(text)
  const parsed: DraftParsed = { ...result, note: null, via: post.via }

  const { data, error } = await admin.from('pick_drafts').insert({
    x_post_id: xPostId,
    post_text: text.slice(0, 5000),
    post_url: post.url || null,
    posted_at: post.postedAt || new Date().toISOString(),
    parsed,
    status: result.picks.length ? 'pending' : 'skipped',
  }).select('*').single()

  // A concurrent run inserted the same post first: the UNIQUE on x_post_id
  // turned the race into a duplicate, which is the outcome we wanted.
  if (error?.code === '23505') return { draft: null, duplicate: true }
  if (error) return { draft: null, duplicate: false, error: error.message }
  return { draft: data as PickDraft, duplicate: false }
}

export interface IngestReport {
  ok: boolean
  skipped?: string
  fetched?: number
  queued?: number
  noPick?: number
  duplicates?: number
  errors?: string[]
  sinceId?: string | null
}

/** Pull Ed's new posts and queue each one. Never throws. */
export async function ingestFromX(admin: any): Promise<IngestReport> {
  if (!(await hasPickDrafts(admin))) return { ok: false, skipped: MIGRATION_MISSING }
  if (!xConfigured()) return { ok: true, skipped: 'X not configured (X_BEARER_TOKEN, X_USER_ID)' }

  // The newest id the INGEST has queued. Read a handful and compare as
  // integers, because ordering by text would put "999" after "1000".
  //
  // Pasted posts are excluded on purpose: Ed pasting this morning's post must
  // not move since_id past the posts between the last run and that one, or
  // the next run would never ask X for them.
  const { data: recent } = await admin
    .from('pick_drafts')
    .select('x_post_id')
    .not('x_post_id', 'is', null)
    .eq('parsed->>via', 'x')
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(20)
  const sinceId = (recent ?? [])
    .map((r: any) => String(r.x_post_id))
    .sort(compareIds)
    .pop() ?? null

  const fetched = await fetchRecentPosts({ sinceId })
  if (!fetched.ok) {
    return { ok: fetched.reason === 'not_configured', skipped: fetched.message, sinceId }
  }

  const report: IngestReport = { ok: true, fetched: fetched.posts.length, queued: 0, noPick: 0, duplicates: 0, errors: [], sinceId }
  for (const post of fetched.posts.slice(0, MAX_PER_RUN)) {
    const { draft, duplicate, error } = await createDraft(admin, {
      text: post.text, url: post.url, postedAt: post.createdAt, xPostId: post.id, via: 'x',
    })
    if (error) report.errors!.push(`${post.id}: ${error}`)
    else if (duplicate) report.duplicates!++
    else if (draft?.status === 'skipped') report.noPick!++
    else report.queued!++
  }
  return report
}

// ---------------------------------------------------------------------------
// Approve
// ---------------------------------------------------------------------------

/** Same derivation as app/api/admin/todays-bets: min_tier is the gate, the flags follow it. */
export function pickAccessColumns(requested: unknown): { min_tier: Tier; is_free: boolean; is_elite: boolean } | { error: string } {
  const value = String(requested ?? 'retail')
  if (!(value in TIER_RANK)) return { error: `Unknown min_tier "${value}".` }
  const tier = normalizeTier(value)
  return { min_tier: tier, is_free: tier === 'retail', is_elite: TIER_RANK[tier] > TIER_RANK.portfolio }
}

/** Clean the admin's edited picks; anything without a bet is dropped. */
export function cleanPicks(input: unknown): ParsedPick[] {
  if (!Array.isArray(input)) return []
  return input.map(normalizePick).filter((p): p is ParsedPick => p !== null)
}

/**
 * The todays_bets rows for an approved draft.
 *
 * `line` gets the PRICE, not the spread. That is what the existing editor
 * calls "Guide Line" (placeholder "-110"), what every existing surface prints
 * beside the bet, and what lib/records.ts oddsOf() falls back to. The spread
 * or total already reads inside the bet text ("Chiefs -3.5").
 */
export function draftToRows(
  draft: Pick<PickDraft, 'x_post_id' | 'posted_at'>,
  picks: ParsedPick[],
  opts: { access: { min_tier: Tier; is_free: boolean; is_elite: boolean }; note: string | null; now?: Date }
): Record<string, unknown>[] {
  const postedAt = draft.posted_at ?? (opts.now ?? new Date()).toISOString()
  // The NY calendar day of the post, the operating day the whole app uses
  // (lib/brief.ts nyToday). A 9pm ET post is that day's card, not tomorrow's.
  const date = nyToday(new Date(postedAt))
  return picks.map(p => {
    const id = crypto.randomUUID()
    return {
      id,
      date,
      sport: p.sport,
      bet: p.bet,
      line: formatOdds(p.odds),
      opponent: p.opponent,
      result: 'pending',
      note: opts.note,
      is_active: true,
      ...opts.access,
      show_on_results: true,
      odds: p.odds,
      market: p.market,
      slug: pickSlug({ id, date, sport: p.sport, bet: p.bet, isFree: opts.access.is_free }),
      posted_at: postedAt,
      source: 'x',
      x_post_id: draft.x_post_id,
    }
  })
}
