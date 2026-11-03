import { MARKETS, toOdds, type Market } from './parse'

/**
 * `odds` and `market` from an admin editor payload, only the keys that were
 * actually sent. An absent key is left out rather than written as null, so an
 * editor that does not know about these fields cannot erase them.
 *
 * Odds go through the same check as the parser: an American price is never
 * inside (-100, 100), and a spread typed into the odds box would otherwise
 * grade a -3.5 favourite as a +3.5 payout (the migration's CHECK rejects it
 * too, but as an opaque 500).
 */
export function engineColumnsFromBody(body: any): { odds?: number | null; market?: Market | null } {
  const out: { odds?: number | null; market?: Market | null } = {}
  if (body && 'odds' in body) out.odds = toOdds(body.odds)
  if (body && 'market' in body) out.market = MARKETS.includes(body.market) ? body.market : null
  return out
}
