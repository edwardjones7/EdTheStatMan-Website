// Server-side live items for the global ticker: the latest Wire headlines and
// the most recent card's record. The client adds live scores on top (from the
// CDN-cached /api/live) -- see components/LiveTicker.tsx.
//
// The root layout calls this on every page, so it is cached as one blob for
// five minutes (and the reads under it are cached reads already). It never
// throws: a ticker that cannot load its extras just shows the saved items.

import { unstable_cache } from 'next/cache'
import { loadWire } from './wire'
import { loadPublishedPicks } from './proof'
import { computeRecord, formatRecord, formatUnits } from './records'
import { deskToday } from './desk'
import { DB_TAGS } from './supabase/cached'

export interface TickerWire {
  sport: string
  headline: string
  href: string
}

export interface TickerRecord {
  /** "Today" or "Nov 11" */
  label: string
  /** "3-1 · +1.8u" */
  text: string
  up: boolean
  href: string
}

export interface TickerExtras {
  wire: TickerWire[]
  record: TickerRecord | null
}

const EMPTY: TickerExtras = { wire: [], record: null }

async function build(): Promise<TickerExtras> {
  const [wire, picks] = await Promise.all([
    loadWire().catch(() => []),
    loadPublishedPicks().catch(() => []),
  ])

  // The latest card with anything graded on it.
  const graded = picks.filter(p => {
    const r = String(p.result ?? '').toLowerCase()
    return p.date && (r === 'win' || r === 'loss' || r === 'push')
  })
  let record: TickerRecord | null = null
  if (graded.length > 0) {
    const last = graded.reduce((d, p) => (p.date! > d ? p.date! : d), '')
    const r = computeRecord(graded.filter(p => p.date === last))
    if (r.w + r.l + r.p > 0) {
      const today = deskToday()
      const label = last === today
        ? 'Today'
        : new Date(`${last}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
      record = {
        label,
        text: `${formatRecord(r)} · ${formatUnits(r.units)}`,
        up: r.units >= 0,
        href: '/portfolio/performance',
      }
    }
  }

  return {
    wire: wire.slice(0, 3).map(w => ({ sport: w.sportLabel, headline: w.headline, href: w.href })),
    record,
  }
}

const cached = unstable_cache(build, ['ticker-extras-v1'], {
  revalidate: 300,
  tags: [DB_TAGS.picks, DB_TAGS.games],
})

export async function loadTickerExtras(): Promise<TickerExtras> {
  try {
    // Bounded: the layout waits on this, and a slow feed must not hold every
    // page. Late extras are simply skipped for this render.
    return await Promise.race([
      cached(),
      new Promise<TickerExtras>(resolve => setTimeout(() => resolve(EMPTY), 2500)),
    ])
  } catch (e) {
    console.error(`[ticker] extras failed: ${(e as Error).message}`)
    return EMPTY
  }
}
