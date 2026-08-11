import type { Metadata } from 'next'
import Link from 'next/link'
import CTASection from '@/components/CTASection'
import NflWeekHub from '@/components/NflWeekHub'
import NflAdminBar from '@/components/NflAdminBar'
import PricingCards from '@/components/PricingCards'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAccess, ACCESS_SELECT } from '@/lib/access'
import { toPublicGame, currentWeekOf, weekLabel } from '@/lib/nfl'
import type { NflGame, PublicNflGame } from '@/lib/nfl'
import { DEFAULT_NFL_HUB } from '@/lib/site-content'
import type { NflHubContent } from '@/lib/site-content'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'NFL Weekly Hub',
  description: 'Week-by-week NFL breakdowns: every matchup with the betting systems and trends that apply, plus Elite-only game analysis and Edge Picks.',
  alternates: { canonical: 'https://edthestatman.com/nfl' },
  openGraph: {
    title: 'NFL Weekly Hub – EdTheStatMan.com',
    description: 'Week-by-week NFL breakdowns: every matchup with the betting systems and trends that apply, plus Elite-only game analysis and Edge Picks.',
    url: 'https://edthestatman.com/nfl',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NFL Weekly Hub – EdTheStatMan.com',
    description: 'Week-by-week NFL breakdowns with systems, trends, and Elite game analysis.',
    images: ['/og-cover.jpg'],
  },
}

export default async function NflHub({
  searchParams,
}: {
  searchParams: { week?: string; type?: string }
}) {
  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let access = resolveAccess(null, false)
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select(ACCESS_SELECT)
      .eq('id', user.id)
      .single()
    access = resolveAccess(profile as any, true)
  }
  const { tier: userTier, isAdmin, hasElite, membership } = access

  const [gamesResult, contentResult] = await Promise.all([
    (admin as any)
      .from('nfl_games')
      .select('*')
      .order('kickoff', { ascending: true, nullsFirst: false }),
    (admin as any).from('site_content').select('value').eq('key', 'nfl_hub').single(),
  ])

  const allGames: NflGame[] = (gamesResult.data ?? []).filter(
    (g: NflGame) => g.is_published || isAdmin
  )
  const content: NflHubContent = {
    ...DEFAULT_NFL_HUB,
    ...(contentResult.data?.value as object ?? {}),
  }

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
    for (const row of sysLinks.data ?? []) linkedCounts[row.game_id].systems++
    for (const row of trendLinks.data ?? []) linkedCounts[row.game_id].trends++
  }

  const season = allGames[0]?.season ?? new Date().getFullYear()

  return (
    <main>
      <section className="section" style={{ paddingBottom: '40px' }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">{content.headerLabel}</span>
            <h1 className="section-title">{content.headerTitle}</h1>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>{content.headerSubtitle}</p>
          </div>

          {isAdmin && (
            <NflAdminBar
              season={season}
              seasonType={active?.season_type}
              week={active?.week}
            />
          )}

          {allGames.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-muted)' }}>
              The {season} NFL schedule drops here soon — check back before kickoff.
            </div>
          ) : (
            <NflWeekHub
              games={weekGames}
              weeks={weeks}
              active={active}
              linkedCounts={linkedCounts}
              hasElite={hasElite}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </section>

      {!hasElite && (
        <section className="section" style={{ background: 'var(--bg-secondary)' }} id="elite">
          <div className="container">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <span className="section-label">Elite — NFL Season Pass</span>
              <h2 className="section-title">{content.eliteCtaTitle}</h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>{content.eliteCtaText}</p>
            </div>
            <div style={{ marginTop: '60px' }}>
              <PricingCards membership={membership} currentTier={userTier} highlight="elite" />
            </div>
            <p style={{ textAlign: 'center', marginTop: '24px' }}>
              <Link href="/win" style={{ color: 'var(--accent-teal)', fontSize: '0.9rem' }}>
                Compare all plans →
              </Link>
            </p>
          </div>
        </section>
      )}

      <CTASection membership={membership} />
    </main>
  )
}
