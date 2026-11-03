// What the global ticker actually shows: figures generated from the graded
// record, then the admin's saved items.
//
// Ticker items are typed by hand into site_content and nothing ever updates
// them, so any number in one goes stale and then contradicts the page under it.
// Seen 2026-11-03: "5-1 in the NBA" over a card reading 41-39, and "4 Portfolio
// Picks for Monday" still running on Tuesday. So records come from lib/proof.ts,
// and a saved item stating a record, a percentage or a named day is left off the
// live ticker. It stays in the saved content, visible in the admin editor.

import { unstable_cache } from 'next/cache'
import { loadProof, BOOK_LABEL } from './proof'
import type { TickerItem } from './site-content'

const DATED_CLAIM = /\b\d+-\d+(-\d+)?\b|\d%|\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/i

function sportIcon(sport: string): string {
  return /basketball|nba|cbb/i.test(sport) ? '🏀' : '🏈'
}

/** The ticker is on every route, so this is cached rather than read per request. */
export const loadTickerFacts = unstable_cache(
  async (): Promise<TickerItem[]> => {
    const proof = await loadProof()
    const items: TickerItem[] = []
    if (proof.headline) {
      const { sport, record, units } = proof.headline
      items.push({
        tag: sport,
        text: `${BOOK_LABEL[proof.headlineBook]} ${record}${proof.headlineInSeason ? ' this season' : ''}, ${units}`,
        icon: sportIcon(sport),
      })
    }
    if (proof.books.members) {
      const { record, units } = proof.books.members
      items.push({ tag: 'Record', text: `${BOOK_LABEL.members} ${record} across all sports, ${units}`, icon: '📈' })
    }
    if (proof.books.free) {
      const { record, units } = proof.books.free
      items.push({ tag: 'Record', text: `${BOOK_LABEL.free} ${record} across all sports, ${units}`, icon: '✅' })
    }
    return items
  },
  ['ticker-facts'],
  { revalidate: 600 }
)

export function liveTickerItems(saved: TickerItem[], facts: TickerItem[]): TickerItem[] {
  const items = [...facts, ...saved.filter(i => !DATED_CLAIM.test(i.text))]
  return items.length > 0 ? items : saved
}
