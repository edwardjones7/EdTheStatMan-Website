import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import CTASection from '@/components/CTASection'
import DeskWeekBoard from '@/components/DeskWeekBoard'
import NflAdminBar from '@/components/NflAdminBar'
import DeskNoteEditor from '@/components/DeskNoteEditor'
import PricingCards from '@/components/PricingCards'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/lib/access-server'
import { atLeastTier, normalizeTier } from '@/lib/access'
import { toPublicGame, currentWeekOf, weekLabel } from '@/lib/nfl'
import type { NflGame, PublicNflGame } from '@/lib/nfl'
import { DESK_SPORTS, deskSportLabel } from '@/lib/desk'

export const dynamic = 'force-dynamic'

export async function generateMetadata(
  { params }: { params: { sport: string } }
): Promise<Metadata> {
  const label = deskSportLabel(params.sport)
  const title = `The Research Desk — ${label}`
  const description = `Every ${label} game on one schedule, with the betting trends curated for that matchup, opening and current lines, and the weekly desk note.`
  const url = `https://edthestatman.com/desk/${params.sport}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: `${title} | EdTheStatMan.com`, description, url, images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: `${title} | EdTheStatMan.com`, description, images: ['/og-cover.jpg'] },
  }
}

export default async function DeskSport({
  params,
  searchParams,
}: {
  params: { sport: string }
  searchParams: { week?: string; type?: string }
}) {
  const sport = params.sport.toLowerCase()
  if (!DESK_SPORTS.includes(sport as any)) notFound()

  const admin = createAdminClient()
  const access = await getAccess()
  const { tier: userTier, isAdmin, membership } = access

  // The schedule itself is the public shell — a visitor should be able to see
  // that the board exists and how much is on it. The curated research attached
  // to each game is what the Desk rung buys.
  const hasDesk = isAdmin || access.atLeast('desk')

  const { data: gamesData } = await (admin as any)
    .from('nfl_games')
    .select('*')
    .order('kickoff', { ascending: true, nullsFirst: false })

  const allGames: NflGame[] = (gamesData ?? []).filter((g: NflGame) => {
    // The `sport` column only exists after tier_ladder_06; before it, every row
    // in this table is NFL by construction.
    const rowSport = g.sport ?? 'nfl'
    return rowSport === sport && (g.is_published || isAdmin)
  })

  // Week list derived from data — nothing hardcodes a week count.
  const weekMap = new Map<string, { season_type: number; week: number }>()
  for (const g of allGames) weekMap.set(`${g.season_type}-${g.week}`, { season_type: g.season_type, week: g.week })
  const weeks = [...weekMap.values()]
    .sort((a, b) => a.season_type - b.season_type || a.week - b.week)
    .map(w => ({ ...w, label: weekLabel(w.season_type, w.week) }))

  const requestedType = searchParams.type === 'post' ? 3 : searchParams.week ? 2 : null
  const requestedWeek = Number(searchParams.week) || null
  const fallback = currentWeekOf(allGames, new Date())
  const active =
    requestedType && requestedWeek && weekMap.has(`${requestedType}-${requestedWeek}`)
      ? { season_type: requestedType, week: requestedWeek }
      : fallback ?? null

  const weekGames: PublicNflGame[] = active
    ? allGames
        .filter(g => g.season_type === active.season_type && g.week === active.week)
        .map(toPublicGame)
    : []

  // Curated link counts per game — proof of depth without shipping the links.
  const gameIds = weekGames.map(g => g.id)
  const linkedCounts: Record<string, { systems: number; trends: number }> = {}
  if (gameIds.length > 0) {
    const [sysLinks, trendLinks] = await Promise.all([
      (admin as any).from('nfl_game_systems').select('game_id').in('game_id', gameIds),
      (admin as any).from('nfl_game_trends').select('game_id').in('game_id', gameIds),
    ])
    for (const id of gameIds) linkedCounts[id] = { systems: 0, trends: 0 }
    for (const row of sysLinks.data ?? []) if (linkedCounts[row.game_id]) linkedCounts[row.game_id].systems++
    for (const row of trendLinks.data ?? []) if (linkedCounts[row.game_id]) linkedCounts[row.game_id].trends++
  }

  const season = allGames[0]?.season ?? new Date().getFullYear()

  // The weekly desk note. The table arrives with tier_ladder_06; until then the
  // query errors harmlessly and the note simply doesn't render.
  let rawNote: {
    title: string; body_html: string; min_tier: string; is_published: boolean
  } | null = null
  if (active) {
    const { data: noteData } = await (admin as any)
      .from('desk_notes')
      .select('title, body_html, min_tier, is_published')
      .eq('sport', sport)
      .eq('season', season)
      .eq('season_type', active.season_type)
      .eq('week', active.week)
      .maybeSingle()
    rawNote = noteData ?? null
  }
  // A draft is visible to its author only; everyone else sees no note at all.
  const note = rawNote && (rawNote.is_published || isAdmin) ? rawNote : null
  const canReadNote = note
    ? isAdmin || atLeastTier(userTier, normalizeTier(note.min_tier))
    : false

  const label = deskSportLabel(sport)

  return (
    <main>
      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">The Research Desk</span>
            <h1 className="section-title">{label} {season}</h1>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              The whole season on one board. Every game, the line and how it has moved,
              and the trends we have pulled for that specific matchup.
            </p>
          </div>

          {DESK_SPORTS.length > 1 && (
            <div className="desk-sports">
              {DESK_SPORTS.map(s => (
                <Link
                  key={s}
                  href={`/desk/${s}`}
                  className={`desk-sport-pill${s === sport ? ' is-active' : ''}`}
                >
                  {deskSportLabel(s)}
                </Link>
              ))}
            </div>
          )}

          {isAdmin && (
            <>
              <NflAdminBar season={season} seasonType={active?.season_type} week={active?.week} />
              {active && (
                <DeskNoteEditor
                  sport={sport}
                  season={season}
                  seasonType={active.season_type}
                  week={active.week}
                  weekLabel={weekLabel(active.season_type, active.week)}
                  existing={rawNote}
                />
              )}
            </>
          )}

          {note && (
            <div className={`desk-note${canReadNote ? '' : ' desk-note--locked'}`}>
              <div className="desk-note__label">
                Desk Note{!note.is_published && ' — draft, visible to you only'}
              </div>
              <h2 className="desk-note__title">{note.title}</h2>
              {canReadNote ? (
                <div
                  className="desk-note__body"
                  dangerouslySetInnerHTML={{ __html: note.body_html }}
                />
              ) : (
                <p className="desk-note__gate">
                  This week&apos;s note is written for Research Desk members.{' '}
                  <Link href="/win">Open the Desk →</Link>
                </p>
              )}
            </div>
          )}

          {allGames.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
              The {season} {label} schedule lands here soon — check back before kickoff.
            </div>
          ) : (
            <DeskWeekBoard
              sport={sport}
              games={weekGames}
              weeks={weeks}
              active={active}
              linkedCounts={linkedCounts}
              hasDesk={hasDesk}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </section>

      {!hasDesk && (
        <section className="section" style={{ background: 'var(--bg-secondary)' }} id="pricing">
          <div className="container">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <span className="section-label">Membership</span>
              <h2 className="section-title">Pull up a <span className="text-gradient">chair</span></h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>
                The Research Desk opens every matchup: the curated trends behind it,
                the desk note, and everything in The Portfolio.
              </p>
            </div>
            <div style={{ marginTop: '60px' }}>
              <PricingCards membership={membership} currentTier={userTier} highlight="desk" />
            </div>
          </div>
        </section>
      )}

      <CTASection membership={membership} />
    </main>
  )
}
