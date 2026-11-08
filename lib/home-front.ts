// The homepage front page (Nov 2026): the shaping behind components/HomeFront.
//
// Everything here is either public already (lines, line moves, Vault records)
// or arrives pre-gated (the brief from lib/brief.ts drops locked picks before
// this module sees them). Headlines are written from the numbers, never typed
// by hand, so a stale story cannot outlive the line it describes.

import { createAdminClient } from './supabase/admin'
import { vaultRowPath } from './vault-row'
import type { BoardRow, HomeBoard } from './home-board'
import type { Brief } from './brief'
import type { ProofData } from './proof'

export interface Mover {
  key: string
  href: string
  matchup: string
  /** "Spread: NYG −3, opened PHI −5.5" */
  detail: string
  /** "8.5 pts" / "+7" / "−6" */
  value: string
  tone: 'up' | 'down' | 'move'
  size: number
}

export interface Story {
  key: string
  href: string
  kicker: string
  title: string
  dek: string
  image: string
}

export interface VaultLeader {
  code: string
  sport: string
  record: string
  pct: number
  href: string
}

const SPORT_IMAGE: Record<string, string> = {
  NFL: '/images/sports/nfl-defense.jpg',
  CFB: '/images/sports/cfb-action.jpg',
  NBA: '/images/sports/nba-dunk.jpg',
  CBB: '/images/sports/cbb-arena.jpg',
}
const SPORT_NAME: Record<string, string> = {
  NFL: 'NFL',
  CFB: 'college football',
  NBA: 'NBA',
  CBB: 'college basketball',
}
const LEAD_IMAGE = '/images/hero-stadium.jpg'

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : `−${fmt(Math.abs(n))}`)

/** Games still to come, in kickoff order; finals after. */
export function upcomingFirst(rows: BoardRow[]): BoardRow[] {
  return [...rows.filter(r => !r.played), ...rows.filter(r => r.played)]
}

/** The biggest spread and total moves on the week, largest first. */
export function lineMovers(board: HomeBoard | null, limit = 4): Mover[] {
  if (!board) return []
  const out: Mover[] = []
  for (const r of board.rows) {
    if (r.played) continue
    if (r.spreadSwing > 0 && r.spread && r.spreadOpen) {
      out.push({
        key: `${r.id}-s`, href: r.href, matchup: r.matchup,
        detail: `Spread: ${r.spread}, opened ${r.spreadOpen}`,
        value: `${fmt(r.spreadSwing)} pts`, tone: 'move', size: r.spreadSwing,
      })
    }
    if (r.totalDelta !== 0 && r.total && r.totalOpen) {
      out.push({
        key: `${r.id}-t`, href: r.href, matchup: r.matchup,
        detail: `Total: ${r.total}, opened ${r.totalOpen}`,
        value: signed(r.totalDelta), tone: r.totalDelta > 0 ? 'up' : 'down', size: Math.abs(r.totalDelta),
      })
    }
  }
  // One entry per game: its bigger move. Two rows for the same matchup read
  // as a duplicate at a glance.
  const seen = new Set<string>()
  return out
    .sort((a, b) => b.size - a.size)
    .filter(m => (seen.has(m.href) ? false : (seen.add(m.href), true)))
    .slice(0, limit)
}

/** The lead story: the biggest spread swing, or the record when nothing has moved. */
export function leadStory(board: HomeBoard | null, proof: ProofData): Story | null {
  const swing = board?.rows
    .filter(r => !r.played && r.spreadSwing >= 1.5 && r.spread && r.spreadOpen)
    .sort((a, b) => b.spreadSwing - a.spreadSwing)[0]
  if (board && swing) {
    return {
      key: 'lead-swing',
      href: swing.href,
      kicker: `${board.title.replace(/, week/, ' · Week')} · Line watch`,
      title: `${swing.matchup} has moved ${fmt(swing.spreadSwing)} points since the open`,
      dek: `${swing.spreadOpen} at the open, ${swing.spread} now. The biggest spread move on the board.`,
      image: LEAD_IMAGE,
    }
  }
  const h = proof.headline
  if (h) {
    return {
      key: 'lead-record',
      href: '/portfolio/performance',
      kicker: 'The record',
      title: `EdTheStatBot is ${h.record} in the ${h.sport}${proof.headlineInSeason ? ' this season' : ''}`,
      dek: `${h.units.replace(/-/g, '−')} at the posted price. Every pick is graded in public.`,
      image: LEAD_IMAGE,
    }
  }
  return null
}

/** Up to four story cards: the totals mover, the card, then the Desk. */
export function stories(board: HomeBoard | null, brief: Brief, lead: Story | null): Story[] {
  const out: Story[] = []

  const total = board?.rows
    .filter(r => !r.played && Math.abs(r.totalDelta) >= 2 && r.total && r.totalOpen)
    .sort((a, b) => Math.abs(b.totalDelta) - Math.abs(a.totalDelta))[0]
  if (board && total && lead?.href !== total.href) {
    out.push({
      key: 'total',
      href: total.href,
      kicker: `${board.sportLabel} · Totals`,
      title: `${total.matchup} total ${total.totalDelta > 0 ? 'climbs' : 'drops'} ${fmt(Math.abs(total.totalDelta))} points to ${total.total}`,
      dek: `Opened ${total.totalOpen}. The largest totals move of the week.`,
      image: SPORT_IMAGE.NFL,
    })
  }

  const when = brief.isToday ? "tonight's" : 'the latest'
  for (const { sport, n } of brief.sportCounts.slice(0, 2)) {
    out.push({
      key: `card-${sport}`,
      href: '/portfolio',
      kicker: SPORT_NAME[sport] ?? sport,
      title: `${n} ${sport} ${n === 1 ? 'play' : 'plays'} on ${when} members' card`,
      dek: 'Graded in public the moment they settle.',
      image: SPORT_IMAGE[sport] ?? SPORT_IMAGE.NFL,
    })
  }

  const desk: Story[] = [
    { key: 'desk-cbb', href: '/desk/cbb', kicker: 'College basketball', title: 'College basketball is on the Research Desk', dek: 'Every game on its own page, with the lines and the research attached.', image: SPORT_IMAGE.CBB },
    { key: 'desk-cfb', href: '/desk/cfb', kicker: 'College football', title: 'Every college football game, researched', dek: 'Lines, line moves and the systems that fit each matchup.', image: SPORT_IMAGE.CFB },
    { key: 'desk-nba', href: '/desk/nba', kicker: 'NBA', title: 'The NBA board, one game per page', dek: 'Opening and current numbers on every game.', image: SPORT_IMAGE.NBA },
  ]
  for (const d of desk) {
    if (out.length >= 4) break
    out.push(d)
  }
  return out.slice(0, 4)
}

/**
 * The strongest large-sample systems in the Vault. Records are public on
 * every Vault row, so the code and record are all that leave the server;
 * the rule itself stays behind the paywall.
 */
export async function loadVaultLeaders(limit = 6, minDecisions = 300): Promise<VaultLeader[]> {
  try {
    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('betting_systems')
      .select('code, sport, w, l, t, pct, is_active')
      .eq('is_active', true)
      .not('code', 'is', null)
      .order('pct', { ascending: false })
      .limit(400)
    if (error) {
      console.error(`[home-front] vault leaders read failed: ${error.message}`)
      return []
    }
    return ((data ?? []) as { code: string; sport: string; w: number | null; l: number | null; t: number | null; pct: number | null }[])
      .filter(r => (r.w ?? 0) + (r.l ?? 0) >= minDecisions && r.pct != null)
      .slice(0, limit)
      .map(r => ({
        code: r.code,
        sport: String(r.sport ?? '').toUpperCase(),
        record: `${r.w ?? 0}-${r.l ?? 0}-${r.t ?? 0}`,
        pct: Math.round((r.pct as number) * 1000) / 10,
        href: vaultRowPath('systems', r.code),
      }))
  } catch (e) {
    console.error('[home-front] vault leaders failed', e)
    return []
  }
}
