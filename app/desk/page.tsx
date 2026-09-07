import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { DESK_SPORTS } from '@/lib/desk'
import { DESK_SPORT_COOKIE } from '@/lib/desk-place'

export const dynamic = 'force-dynamic'

/**
 * The Desk always opens on a sport: whichever one the reader was last on.
 *
 * The week is not decided here. `/desk/[sport]` reads its own per-sport cookie,
 * so landing on college football lands on the college week you left, not on the
 * NFL's. Splitting it that way also means this route stays correct for someone
 * who has never been here: an unknown or missing cookie is just the first sport.
 */
export default function DeskIndex() {
  const last = cookies().get(DESK_SPORT_COOKIE)?.value
  const sport = DESK_SPORTS.includes(last as any) ? last : DESK_SPORTS[0]
  redirect(`/desk/${sport}`)
}
