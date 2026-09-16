/**
 * Which league the reader was last on.
 *
 * Only the SPORT is remembered. The week deliberately is not: a bare
 * `/desk/nfl` or `/desk/cfb` always opens on the week being played or the one
 * coming next, computed by `currentWeekOf()`. That is the whole point of the
 * board, and a remembered week fought it -- clicking back through the season
 * and returning a day later reopened whatever week you last looked at, not the
 * one that matters now.
 *
 * What that costs, honestly: leaving the Desk for the Portfolio and coming back
 * no longer returns you to the week you were reading. The week lives in the URL
 * (`?week=5`), so a reload, a bookmark and a shared link all still hold it; only
 * a bare Desk link resets. Between the two, opening on the current week is the
 * behaviour the board is for.
 *
 * A COOKIE RATHER THAN localStorage, because the decision is made on the SERVER:
 * `/desk` reads it to pick a league before anything renders. If the client had
 * to read it and then redirect, the reader would watch the wrong league paint
 * and jump.
 *
 * WRITTEN BY THE CLIENT, READ BY THE SERVER. A Server Component cannot set a
 * cookie in Next 14 -- only a Route Handler, a Server Action or middleware can
 * -- and a route handler round trip to record a preference is more machinery
 * than this deserves. components/DeskWeekBoard writes it with document.cookie.
 *
 * NOT SECURITY. It steers a default and nothing else; the value is validated
 * against DESK_SPORTS before it is used, and the worst a forged one can do is
 * open the league you were not on.
 */

/** Last sport viewed, so the nav and /desk can return you to it. */
export const DESK_SPORT_COOKIE = 'desk_sport'

/** A week ages out of nothing now, but the sport is worth a season of memory. */
export const DESK_PLACE_MAX_AGE = 7 * 24 * 60 * 60

/**
 * The per-sport week cookie this board used to set, kept only so the board can
 * expire the ones already in readers' browsers. Nothing reads it. Delete this
 * and its one caller once the 7 day max-age on the last of them has run out
 * (written through 2026-09-15, so any time after 2026-09-22).
 */
export function retiredDeskWeekCookie(sport: string): string {
  return `desk_week_${sport}`
}
