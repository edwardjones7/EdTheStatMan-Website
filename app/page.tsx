import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createCachedClient, DB_TAGS } from '@/lib/supabase/cached'
import { SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import type { AllSiteContent } from '@/lib/site-content'
import type { HeroCta } from '@/components/HomeHero'
import HomeFront from '@/components/HomeFront'
import Features from '@/components/Features'
import CTASection from '@/components/CTASection'
import HomeEditor from '@/components/HomeEditor'
import { resolveAccess, ACCESS_SELECT } from '@/lib/access'
import { buildBrief } from '@/lib/brief'
import type { BriefSource } from '@/lib/brief'
import { loadProofWithSeries } from '@/lib/proof'
import { loadVaultLeaders } from '@/lib/home-front'
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
  const proofPromise = loadProofWithSeries()
  // The whole week: the lines strip shows every game, the table the first eight.
  const boardPromise = loadHomeBoard(new Date(), { maxRows: Infinity })
  const leadersPromise = loadVaultLeaders()
  const supabase = await createClient()

  const { data: contentRows } = await (createCachedClient([DB_TAGS.content]) as any).from('site_content').select('key, value')

  const raw: Record<string, unknown> = {}
  for (const row of (contentRows ?? []) as { key: string; value: unknown }[]) {
    raw[row.key] = row.value
  }

  // Merge DB overrides with defaults; for features cards, always use correct hrefs/linkTexts from defaults
  const rawFeatures = raw.features as any ?? {}
  const mergedFeatures = { ...SITE_CONTENT_DEFAULTS.features, ...rawFeatures }
  if (rawFeatures.cards && Array.isArray(rawFeatures.cards)) {
    mergedFeatures.cards = SITE_CONTENT_DEFAULTS.features.cards.map((defaults, i) => {
      const saved = rawFeatures.cards[i] ?? {}
      // A saved card that is still the retired Expert Blog (the slot became
      // the Research Desk in Nov 2026) is ignored rather than rendered with
      // the Desk's link under the blog's words. Saving the card in the admin
      // editor replaces it and this stops mattering.
      const override = saved.title === 'Expert Blog' ? {} : saved
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
  }

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
  const { data: briefRows } = await (createCachedClient([DB_TAGS.picks]) as any)
    .from('todays_bets')
    .select('id, date, sport, bet, line, opponent, result, is_active, is_free, is_elite, show_on_results')
  const brief = buildBrief((briefRows ?? []) as BriefSource[], userTier, isAdmin)
  const [{ proof, series }, board, trial, leaders] = await Promise.all([proofPromise, boardPromise, trialPromise, leadersPromise])
  const cta: HeroCta =
    !user || !trial ? { kind: 'signup' }
    : hasDesk ? { kind: 'desk', trialEndsAt: trial.onTrial ? trial.endsAt : null }
    : trial.available ? { kind: 'trial' }
    : { kind: 'plans', expired: membership === 'expired' }

  const front = (
    <HomeFront
      board={board}
      brief={brief}
      proof={proof}
      series={series}
      leaders={leaders}
      cta={cta}
      signedOut={!user}
    />
  )

  return (
    <div className="home">
      {isAdmin ? (
        // Admin gets the interactive editor with a single pencil FAB
        // (LiveTicker is rendered inside HomeEditor for admins)
        <HomeEditor content={content} hero={front} />
      ) : (
        // Everyone else gets static server-rendered sections
        // (the ticker is rendered globally by the root layout)
        <>
          {front}
          <Features        content={content.features} />
          <CTASection      content={content.cta_section} membership={membership} />
        </>
      )}
    </div>
  )
}
