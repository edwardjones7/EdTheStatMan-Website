import { NextResponse } from 'next/server'
import { loadLiveFeed, LIVE_TTL } from '@/lib/live/scoreboard'
import { LIVE_SPORTS, type LiveSport } from '@/lib/live/types'

/**
 * Live scores and lines for the front page. Public, identical for every
 * visitor, and cached at the CDN for LIVE_TTL seconds: however many people
 * have the page open, ESPN and Supabase see the same handful of requests.
 * Nothing per-visitor (picks, access) goes through here.
 */
export async function GET(req: Request) {
  const asked = (new URL(req.url).searchParams.get('sports') ?? LIVE_SPORTS.join(','))
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter((s): s is LiveSport => (LIVE_SPORTS as readonly string[]).includes(s))
  const sports = asked.length > 0 ? Array.from(new Set(asked)).sort() as LiveSport[] : [...LIVE_SPORTS]

  const feed = await loadLiveFeed(sports)
  return NextResponse.json(feed, {
    headers: {
      'Cache-Control': `public, max-age=0, s-maxage=${LIVE_TTL}, stale-while-revalidate=60`,
    },
  })
}
