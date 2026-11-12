import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import type { Database } from './types'
import { boundRead } from './auth-timeout'

/**
 * A service-role client whose READS go through Next's data cache.
 *
 * WHY. The public pages (home, Vault, Desk, Portfolio) are force-dynamic
 * because they gate on the visitor's tier, and every render re-read the same
 * shared tables straight from Supabase. With crawlers walking every game, team
 * and system page, that blew the Free plan's 5 GB egress and 1 GB log quota in
 * Nov 2026 and Supabase restricted the project -- the whole site went down.
 * The data is identical for every visitor; only the gating differs. So the
 * shared reads are cached here and the per-visitor parts (profile, trial) stay
 * on the uncached clients.
 *
 * HOW. supabase-js takes a custom fetch. GET/HEAD requests get
 * `next: { revalidate, tags }`, which Next honours even on a force-dynamic page
 * because an explicit revalidate beats the page default. Writes pass through
 * untouched -- never use this client to write anyway.
 *
 * FRESHNESS. Every write path that changes one of these tables calls
 * invalidate(tag) so an edit shows up immediately; the revalidate window is
 * only the backstop for writes that happen outside the app (SQL editor,
 * scripts). Keep tags coarse: one per table family.
 */
export const DB_TAGS = {
  /** todays_bets -- picks, the record, proof */
  picks: 'db:picks',
  /** betting_systems, betting_trends */
  vault: 'db:vault',
  /** nfl_games, nfl_game_systems, nfl_game_trends (all sports) */
  games: 'db:games',
  /** site_content */
  content: 'db:content',
} as const

export type DbTag = (typeof DB_TAGS)[keyof typeof DB_TAGS]

const DEFAULT_REVALIDATE = 300

export function createCachedClient(tags: DbTag[], revalidate = DEFAULT_REVALIDATE) {
  const cachedFetch: typeof fetch = (input, init) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    if (method !== 'GET' && method !== 'HEAD') return fetch(input, init)
    // Bounded: when Supabase is unreachable a read fails in seconds instead of
    // hanging the page, and Next keeps serving the last cached copy meanwhile.
    return fetch(input, { ...boundRead(init), cache: undefined, next: { revalidate, tags } } as RequestInit)
  }

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, global: { fetch: cachedFetch } }
  )
}

/** Drop cached reads for these tables. Call after any write to them. */
export function invalidate(...tags: DbTag[]) {
  for (const tag of tags) {
    try {
      revalidateTag(tag)
    } catch (e) {
      // Outside a request scope (a script) there is no cache to drop.
      console.warn(`[cache] revalidateTag(${tag}) skipped: ${(e as Error).message}`)
    }
  }
}
