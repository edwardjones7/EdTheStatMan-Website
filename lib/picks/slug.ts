/**
 * Pick URLs.
 *
 * A slug is permanent once Google has indexed the page (vault Decisions
 * 2026-10-15: "Cheap until picks pages are indexed; their slugs then become
 * permanent"), so it is minted once, when the pick is created, and nothing ever
 * recomputes it from the row. Editing a pick's bet text later does not move its
 * URL.
 *
 * Shape: date-sport-bet-shortid, e.g. 2026-10-15-nfl-chiefs-3-5-a1b2c3. The
 * short id is the first six hex digits of the row's uuid, which makes the slug
 * unique without a database round trip -- the caller generates the uuid before
 * the insert for exactly this reason.
 *
 * A MEMBERS' PICK NEVER GETS ITS BET IN THE SLUG. Its page hides the bet until
 * the game is graded; a URL that spelled it out would give it away in the
 * address bar, the sitemap and every share preview. It gets "pick" instead.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

function slugPart(value: string | null | undefined, max = 48): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\+/g, ' plus ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
}

export function pickSlug(input: {
  id: string
  date: string | null
  sport: string | null
  bet: string | null
  isFree: boolean
}): string {
  const short = input.id.replace(/-/g, '').slice(0, 6).toLowerCase()
  const parts = [
    slugPart(input.date, 10),
    slugPart(input.sport, 12),
    input.isFree ? slugPart(input.bet) || 'pick' : 'pick',
    short,
  ].filter(Boolean)
  return parts.join('-')
}

/** The public path for a row, by slug when it has one and by id before the migration. */
export function pickPath(row: { id: string; slug?: string | null }): string {
  return `/picks/${row.slug || row.id}`
}

/** "-110" / "+130" for display, or null. */
export function formatOdds(odds: number | null | undefined): string | null {
  if (typeof odds !== 'number' || !Number.isFinite(odds)) return null
  return odds > 0 ? `+${Math.round(odds)}` : String(Math.round(odds))
}
