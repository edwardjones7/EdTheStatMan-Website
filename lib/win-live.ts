// The "this week" strip above the plans on /win: how much is on the Desk right
// now, so the offer opens on live activity rather than on a price list.
//
// Every read is a cached one (lib/supabase/cached.ts): /win is force-dynamic
// and public, and these numbers are the same for every visitor. Only COUNTS
// leave this module; no game, link or pick reaches the page.
//
// "This week" is the next seven days of Desk games plus the last seven days of
// posted picks. The windows are rounded (games to the hour by loadUpcoming,
// picks to the day here) so the cached query URLs, and so their cache keys,
// do not change on every request.

import { createCachedClient, DB_TAGS } from './supabase/cached'
import { loadUpcoming } from './feeds/upcoming'
import { LIVE_SPORTS, type LiveSport } from './live/types'
import { easternDate, addDays } from './desk'

export interface WinLive {
  games: number
  /** Desk games in the window with at least one Vault system or trend linked. */
  gamesWithResearch: number
  /** System and trend links across those games. */
  linked: number
  /** Public picks dated in the last seven days. */
  picks: number
}

/** PostgREST puts .in() lists in the URL; keep each request comfortably short. */
const CHUNK = 120

async function linkCount(ids: string[]): Promise<{ linked: number; games: number }> {
  if (ids.length === 0) return { linked: 0, games: 0 }
  const db = createCachedClient([DB_TAGS.games]) as any
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK))
  const results = await Promise.all(chunks.flatMap(c => [
    db.from('nfl_game_systems').select('game_id').in('game_id', c),
    db.from('nfl_game_trends').select('game_id').in('game_id', c),
  ]))
  const withAny = new Set<string>()
  let linked = 0
  for (const r of results) {
    for (const row of (r?.data ?? []) as { game_id: string }[]) {
      linked++
      withAny.add(row.game_id)
    }
  }
  return { linked, games: withAny.size }
}

async function pickCount(): Promise<number> {
  const today = easternDate(new Date())
  const from = addDays(today, -6)
  const db = createCachedClient([DB_TAGS.picks]) as any
  const { data, error } = await db
    .from('todays_bets')
    .select('id, is_active, show_on_results')
    .gte('date', from)
    .lte('date', today)
  if (error) return 0
  // Same "is it public" rule as the Desk board: an inactive pick that was
  // never published is still a draft.
  return ((data ?? []) as any[]).filter(r => !(r.is_active === false && r.show_on_results !== true)).length
}

export async function loadWinLive(): Promise<WinLive | null> {
  try {
    const games = (await loadUpcoming([...LIVE_SPORTS] as LiveSport[], 7)).filter(g => g.status !== 'post')
    const [links, picks] = await Promise.all([linkCount(games.map(g => g.id)), pickCount()])
    return { games: games.length, gamesWithResearch: links.games, linked: links.linked, picks }
  } catch (e) {
    console.error(`[win-live] failed: ${(e as Error).message}`)
    return null
  }
}
