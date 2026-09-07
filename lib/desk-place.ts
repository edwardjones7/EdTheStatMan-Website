/**
 * Where the reader last was on the Desk.
 *
 * The board is force-dynamic and its week lives in the URL, so a week survives a
 * reload or a shared link. What it did not survive was LEAVING: clicking the
 * Portfolio and coming back landed you on `/desk/nfl` with no query string,
 * which falls through to currentWeekOf() -- the first week with something still
 * to play. Someone reading Week 5 was put back on Week 1 every time, and someone
 * on college football was put back on the NFL, because the nav link names the
 * first entry in DESK_SPORTS.
 *
 * A COOKIE RATHER THAN localStorage, because the decision is made on the SERVER.
 * The board renders the week it was asked for; if the client had to read the
 * place and then redirect, the reader would watch Week 1 paint and jump. The
 * cookie is on the request, so the first render is already the right week.
 *
 * WRITTEN BY THE CLIENT, READ BY THE SERVER. A Server Component cannot set a
 * cookie in Next 14 -- only a Route Handler, a Server Action or middleware can
 * -- and a route handler round trip per week click to record a preference is
 * more machinery than this deserves. components/DeskWeekBoard writes it with
 * document.cookie as the week changes.
 *
 * NOT SECURITY. It steers a default and nothing else; every value is validated
 * against the weeks that actually exist before it is used, and the worst a
 * forged one can do is open the board on a different week of your own season.
 */

/** Last sport viewed, so the nav and /desk can return you to it. */
export const DESK_SPORT_COOKIE = 'desk_sport'

/** Per sport, so switching leagues does not carry the other one's week over. */
export function deskWeekCookie(sport: string): string {
  return `desk_week_${sport}`
}

/**
 * A week ages out after seven days.
 *
 * Holding a place forever is the wrong trade: football weeks turn over, and
 * somebody returning after the season has moved on wants the current week, not
 * the one they happened to leave open. Seven days is one turn of the schedule --
 * long enough that a place survives everything short of skipping a week, short
 * enough that it cannot strand you in September in November.
 */
export const DESK_PLACE_MAX_AGE = 7 * 24 * 60 * 60

export interface DeskPlace {
  season: number
  seasonType: number
  week: number
}

/** `2026-2-5`. Season included so last season's place is never applied. */
export function formatDeskPlace(p: DeskPlace): string {
  return `${p.season}-${p.seasonType}-${p.week}`
}

export function parseDeskPlace(value: string | undefined | null): DeskPlace | null {
  if (!value) return null
  const m = /^(\d{4})-(\d)-(\d{1,2})$/.exec(value.trim())
  if (!m) return null
  const place = { season: Number(m[1]), seasonType: Number(m[2]), week: Number(m[3]) }
  if (!Number.isFinite(place.season) || !Number.isFinite(place.week)) return null
  return place
}
