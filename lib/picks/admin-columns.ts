import { MARKETS, toOdds, type Market } from './parse'
import { unitAmount } from '@/lib/records'

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

/**
 * `risk` and `win` from an admin editor payload: the units a pick risks and
 * wins (lib/records.ts grades on them, 1.1 / 1 when blank). Stored as a plain
 * number string ("2", "1.8") whatever was typed ("2u", "2 units"), so every
 * reader sees one shape. A value that is not a positive number is an error
 * rather than a silent blank, which would grade the pick at 1.1 / 1 when Ed
 * meant something else.
 */
export function stakeColumnsFromBody(body: any): { risk: string | null; win: string | null } | { error: string } {
  const one = (key: 'risk' | 'win', label: string): string | null | { error: string } => {
    const raw = String(body?.[key] ?? '').trim()
    if (!raw) return null
    const n = unitAmount(raw)
    return n === null ? { error: `${label} must be a number of units, e.g. 1.1 or 2.` } : String(n)
  }
  const risk = one('risk', 'Units risked')
  const win = one('win', 'Units to win')
  if (risk && typeof risk === 'object') return risk
  if (win && typeof win === 'object') return win
  return { risk, win }
}
