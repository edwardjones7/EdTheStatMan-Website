import Link from 'next/link'
import type { WinLive } from '@/lib/win-live'
import type { ProofData } from '@/lib/proof'
import { BOOK_LABEL } from '@/lib/proof'
import '@/styles/win-live.css'

/**
 * The live strip above the plans on /win: what is on the Desk this week, then
 * the record by sport.
 *
 * Server component; it only ever receives counts (lib/win-live.ts) and the
 * shaped proof (lib/proof.ts). The sport line names only sports that are UP in
 * units and above break-even; a losing sport is not featured here, and it is
 * still on the full proof block below the plans and on the results page, which
 * this links to, so nothing is hidden.
 */
export default function WinLiveStrip({ live, proof }: { live: WinLive | null; proof: ProofData }) {
  const winners = proof.sports.filter(s => s.unitsValue > 0 && s.beatsBreakEven).slice(0, 4)
  const items = live
    ? [
        { n: live.games, label: live.games === 1 ? 'game on the Desk' : 'games on the Desk', href: '/desk' },
        {
          n: live.linked,
          label: live.linked === 1 ? 'system or trend fits' : 'systems and trends fit',
          note: live.gamesWithResearch > 0 ? `across ${live.gamesWithResearch} ${live.gamesWithResearch === 1 ? 'game' : 'games'}` : null,
          href: '/vault',
        },
        { n: live.picks, label: live.picks === 1 ? 'pick posted' : 'picks posted', note: 'last 7 days', href: '/portfolio' },
      ]
    : []
  const anyLive = items.some(i => i.n > 0)
  if (!anyLive && winners.length === 0) return null

  return (
    <section className="wl" aria-label="This week on the Desk">
      {anyLive && (
        <div className="wl-row">
          <span className="wl-kick">
            <span className="wl-dot" aria-hidden="true" /> This week
          </span>
          <ul className="wl-items">
            {items.map(i => (
              <li key={i.label}>
                <Link href={i.href} className="wl-item">
                  <b>{i.n.toLocaleString()}</b>
                  <span>
                    {i.label}
                    {i.note && <small>{i.note}</small>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {winners.length > 0 && (
        <div className="wl-row wl-row--record">
          <span className="wl-kick">{BOOK_LABEL[proof.headlineBook]}</span>
          <ul className="wl-sports">
            {winners.map(s => (
              <li key={s.sport}>
                <b>{s.sport}</b> <span className="wl-rec">{s.record}</span>{' '}
                <span className="wl-units">{s.units}</span>
              </li>
            ))}
          </ul>
          <Link href="/portfolio/performance" className="wl-ledger">Every pick &rarr;</Link>
        </div>
      )}
    </section>
  )
}
