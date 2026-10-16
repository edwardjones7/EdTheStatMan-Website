/**
 * Ed's own X timeline, read through the X API v2.
 *
 * GET /2/users/:id/tweets with replies and retweets excluded: a reply is a
 * conversation and a retweet is somebody else's pick, and neither belongs in
 * the queue. Owned reads are pay-per-use (about $0.001 a post, vault Decisions
 * 2026-10-15), so `since_id` matters -- each run asks only for what is newer
 * than the newest post already queued.
 *
 * NEVER THROWS. The callers are a cron and an admin button, and both should say
 * "X isn't set up" or "X answered 429" rather than 500. Missing env is the
 * normal state until Eddie adds the keys, so it is a result, not an error.
 *
 * Env:
 *   X_BEARER_TOKEN  app-only bearer token from the X developer console
 *   X_USER_ID       Ed's numeric user id (not the @handle)
 *   X_USERNAME      optional, only used to build nicer post URLs
 */

export interface XPost {
  id: string
  text: string
  createdAt: string | null
  url: string
}

export type XFetchResult =
  | { ok: true; posts: XPost[] }
  | { ok: false; reason: 'not_configured' | 'http_error' | 'network_error'; message: string; status?: number }

const API = 'https://api.x.com/2'
/** X's per-page cap is 100. */
const PAGE_SIZE = 100
/** A few pages covers days of downtime; past that, paste the stragglers. */
const MAX_PAGES = 3
/** With nothing queued yet, look back this far instead of pulling months of history. */
const FIRST_RUN_DAYS = 3

export function xConfigured(): boolean {
  return !!process.env.X_BEARER_TOKEN && !!process.env.X_USER_ID
}

export function xPostUrl(id: string): string {
  const user = process.env.X_USERNAME?.replace(/^@/, '')
  return user ? `https://x.com/${user}/status/${id}` : `https://x.com/i/status/${id}`
}

/** The status id inside an x.com / twitter.com post URL, or null. */
export function xPostIdFromUrl(url: string | null | undefined): string | null {
  const m = String(url ?? '').match(/(?:x|twitter)\.com\/(?:[^/]+|i(?:\/web)?)\/status(?:es)?\/(\d{5,25})/i)
  return m ? m[1] : null
}

export async function fetchRecentPosts(opts: { sinceId?: string | null; now?: Date } = {}): Promise<XFetchResult> {
  const token = process.env.X_BEARER_TOKEN
  const userId = process.env.X_USER_ID
  if (!token || !userId) {
    return { ok: false, reason: 'not_configured', message: 'X is not configured: set X_BEARER_TOKEN and X_USER_ID.' }
  }

  const posts: XPost[] = []
  let nextToken: string | undefined

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      exclude: 'replies,retweets',
      max_results: String(PAGE_SIZE),
      // note_tweet carries the full text of a post over 280 characters; `text`
      // alone is truncated for those, which would cut a long card in half.
      'tweet.fields': 'created_at,note_tweet',
    })
    if (opts.sinceId) params.set('since_id', opts.sinceId)
    else {
      const from = new Date((opts.now ?? new Date()).getTime() - FIRST_RUN_DAYS * 864e5)
      params.set('start_time', from.toISOString().replace(/\.\d{3}Z$/, 'Z'))
    }
    if (nextToken) params.set('pagination_token', nextToken)

    let res: Response
    try {
      res = await fetch(`${API}/users/${encodeURIComponent(userId)}/tweets?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })
    } catch (e: any) {
      return { ok: false, reason: 'network_error', message: e?.message ?? 'X request failed' }
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, reason: 'http_error', status: res.status, message: `X answered ${res.status}: ${body.slice(0, 300)}` }
    }

    const json: any = await res.json().catch(() => null)
    for (const t of json?.data ?? []) {
      if (!t?.id) continue
      posts.push({
        id: String(t.id),
        text: String(t.note_tweet?.text ?? t.text ?? ''),
        createdAt: t.created_at ?? null,
        url: xPostUrl(String(t.id)),
      })
    }
    nextToken = json?.meta?.next_token
    if (!nextToken) break
  }

  // Oldest first, so the queue reads in the order Ed posted.
  posts.sort((a, b) => compareIds(a.id, b.id))
  return { ok: true, posts }
}

/** X ids are 64-bit snowflakes: compare as integers, never as floats or text. */
export function compareIds(a: string, b: string): number {
  try {
    const x = BigInt(a), y = BigInt(b)
    return x < y ? -1 : x > y ? 1 : 0
  } catch {
    return a.localeCompare(b)
  }
}
