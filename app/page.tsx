import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import type { AllSiteContent } from '@/lib/site-content'
import HomeHero, { HomeBoardSection, type HeroCta, type HeroCard, type HeroProof } from '@/components/HomeHero'
import HomeFreePicks from '@/components/HomeFreePicks'
import { BOOK_LABEL } from '@/lib/proof'
import { minus } from '@/lib/home-board'
import Features from '@/components/Features'
import SportsBand from '@/components/SportsBand'
import CTASection from '@/components/CTASection'
import HomeEditor from '@/components/HomeEditor'
import TodaysBrief from '@/components/TodaysBrief'
import { resolveAccess, ACCESS_SELECT } from '@/lib/access'
import { buildBrief } from '@/lib/brief'
import type { BriefSource } from '@/lib/brief'
import { loadProof } from '@/lib/proof'
import { loadHomeBoard } from '@/lib/home-board'
import { loadTrialState } from '@/lib/trial'
import '@/styles/home.css'

export const metadata: Metadata = {
  title: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
  description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win. Data-driven NFL, NBA, college football & basketball.',
  alternates: { canonical: 'https://edthestatman.com' },
  openGraph: {
    title: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
    description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win. Data-driven NFL, NBA, college football & basketball.',
    url: 'https://edthestatman.com',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
    description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win.',
    images: ['/og-cover.jpg'],
  },
}

export const dynamic = 'force-dynamic'

export default async function Home() {
  // Started first and awaited late: it is an independent read, so it should not
  // add a round trip to the page.
  const proofPromise = loadProof()
  const boardPromise = loadHomeBoard()
  const supabase = await createClient()

  const { data: contentRows } = await (supabase as any).from('site_content').select('key, value')

  const raw: Record<string, unknown> = {}
  for (const row of (contentRows ?? []) as { key: string; value: unknown }[]) {
    raw[row.key] = row.value
  }

  // Merge DB overrides with defaults; for features cards, always use correct hrefs/linkTexts from defaults
  const rawFeatures = raw.features as any ?? {}
  const mergedFeatures = { ...SITE_CONTENT_DEFAULTS.features, ...rawFeatures }
  // Saved cards attach by id. The six cards saved before Nov 2026 have none, so
  // they fall away rather than putting Model Picks' words on the Desk's link.
  const savedCards: any[] = Array.isArray(rawFeatures.cards) ? rawFeatures.cards : []
  mergedFeatures.cards = SITE_CONTENT_DEFAULTS.features.cards.map(defaults => {
    const override = savedCards.find(c => c?.id === defaults.id) ?? {}
    return {
      ...defaults,
      ...override,
      // "Â " is a mis-decoded non-breaking space in production's saved text.
      text: String(override.text ?? defaults.text).replace(/Â? /g, ' ').trim(),
      href: defaults.href,
      linkText: defaults.linkText,
      isExternal: defaults.isExternal,
    }
  })

  const content: AllSiteContent = {
    hero:             { ...SITE_CONTENT_DEFAULTS.hero,             ...(raw.hero             as object ?? {}) },
    action_card:      { ...SITE_CONTENT_DEFAULTS.action_card,      ...(raw.action_card      as object ?? {}) },
    features:         mergedFeatures,
    cta_section:      { ...SITE_CONTENT_DEFAULTS.cta_section,      ...(raw.cta_section      as object ?? {}) },
    systems_overview: { ...SITE_CONTENT_DEFAULTS.systems_overview, ...(raw.systems_overview as object ?? {}) },
    ticker:           { ...SITE_CONTENT_DEFAULTS.ticker,           ...(raw.ticker           as object ?? {}) },
    model_picks:      { ...SITE_CONTENT_DEFAULTS.model_picks,      ...(raw.model_picks      as object ?? {}) },
    nfl_hub:          { ...SITE_CONTENT_DEFAULTS.nfl_hub,          ...(raw.nfl_hub          as object ?? {}) },
  }

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
  const { tier: userTier, isAdmin, membership } = access

  // The trial state decides the hero's primary button (components/HomeHero.tsx):
  // whether a member without the Desk may start one, and whether a Desk member
  // is on one. Started here and awaited with the other independent reads.
  const hasDesk = isAdmin || access.atLeast('desk')
  const trialPromise = user ? loadTrialState(createAdminClient(), user.id) : null

  // Today's Brief. Read through the admin client for the same reason the
  // Portfolio page does -- the app's tier logic is the gate, not RLS -- and
  // gated immediately by buildBrief(), which drops locked picks server-side and
  // returns only a count for them.
  const { data: briefRows } = await (createAdminClient() as any)
    .from('todays_bets')
    .select('id, date, sport, bet, line, opponent, result, is_active, is_free, is_elite, show_on_results')
  const brief = buildBrief((briefRows ?? []) as BriefSource[], userTier, isAdmin)
  // The record in the hero comes from lib/proof.ts, not brief.record, so it
  // splits the two books the way every other surface does.
  const [proof, board, trial] = await Promise.all([proofPromise, boardPromise, trialPromise])
  const cta: HeroCta =
    !user || !trial ? { kind: 'signup' }
    : hasDesk ? { kind: 'desk', trialEndsAt: trial.onTrial ? trial.endsAt : null }
    : trial.available ? { kind: 'trial' }
    : { kind: 'plans', expired: membership === 'expired' }
  // Only for someone who can read the card. All padlocks tells a visitor nothing
  // the hero's "4 plays" line has not already said.
  const briefNode = brief.total > 0 && brief.lockedCount === 0 ? <TodaysBrief brief={brief} /> : null

  // The hook above the slogan: what is on the card right now.
  const card: HeroCard | null = brief.date && brief.total > 0
    ? {
        isToday: brief.isToday,
        total: brief.total,
        locked: brief.lockedCount,
        sports: brief.sportCounts.map(c => c.sport),
      }
    : null

  // The proof line under the buttons: the best sport beside every whole book,
  // so a good stretch in one sport never stands in for the whole record.
  const tone = (v: number) => (v > 0 ? 'up' : v < 0 ? 'down' : 'flat') as HeroProof['tone']
  const heroProof: HeroProof[] = []
  if (proof.headline) {
    heroProof.push({
      label: `${proof.headline.sport}${proof.headlineInSeason ? ' this season' : ''}`,
      record: proof.headline.record,
      units: minus(proof.headline.units),
      tone: tone(proof.headline.unitsValue),
    })
  }
  if (proof.books.members) {
    heroProof.push({
      label: `${BOOK_LABEL.members}, all sports`,
      record: proof.books.members.record,
      units: minus(proof.books.members.units),
      tone: tone(proof.books.members.unitsValue),
    })
  }
  if (proof.books.free) {
    heroProof.push({
      label: `${BOOK_LABEL.free}, all sports`,
      record: proof.books.free.record,
      units: minus(proof.books.free.units),
      tone: tone(proof.books.free.unitsValue),
    })
  }
  const heroNode = (
    <>
      <HomeHero
        cta={cta}
        title={content.hero.title}
        accent={content.hero.titleAccent}
        description={content.hero.description}
        card={card}
        proof={heroProof}
      />
      <HomeBoardSection board={board} hasDesk={cta.kind === 'desk'} />
    </>
  )

  return (
    <div className="home">
      {isAdmin ? (
        // Admin gets the interactive editor with a single pencil FAB
        // (LiveTicker is rendered inside HomeEditor for admins)
        <HomeEditor content={content} hero={heroNode} brief={briefNode} />
      ) : (
        // Everyone else gets static server-rendered sections
        // (the ticker is rendered globally by the root layout)
        <>
          {heroNode}
          {briefNode}
          <Features        content={content.features} />
          <SportsBand />
          <CTASection      content={content.cta_section} membership={membership} trial={cta.kind === 'signup' || cta.kind === 'trial'} />
          {/* Last on purpose: it is the fallback for whoever passed on the trial. */}
          {!user && <HomeFreePicks />}
        </>
      )}
    </div>
  )
}
