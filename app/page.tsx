import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import type { AllSiteContent } from '@/lib/site-content'
import Hero from '@/components/Hero'
import Features from '@/components/Features'
import CTASection from '@/components/CTASection'
import SportsBand from '@/components/SportsBand'
import HomeEditor from '@/components/HomeEditor'
import { resolveAccess, ACCESS_SELECT } from '@/lib/access'

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
  const supabase = await createClient()

  const { data: contentRows } = await (supabase as any).from('site_content').select('key, value')

  const raw: Record<string, unknown> = {}
  for (const row of (contentRows ?? []) as { key: string; value: unknown }[]) {
    raw[row.key] = row.value
  }

  // Merge DB overrides with defaults; for features cards, always use correct hrefs/linkTexts from defaults
  const rawFeatures = raw.features as any ?? {}
  const mergedFeatures = { ...SITE_CONTENT_DEFAULTS.features, ...rawFeatures }
  if (rawFeatures.cards && Array.isArray(rawFeatures.cards)) {
    mergedFeatures.cards = SITE_CONTENT_DEFAULTS.features.cards.map((defaults, i) => ({
      ...defaults,
      ...(rawFeatures.cards[i] ?? {}),
      href: defaults.href,
      linkText: defaults.linkText,
      isExternal: defaults.isExternal,
    }))
  }

  const content: AllSiteContent = {
    hero:             { ...SITE_CONTENT_DEFAULTS.hero,             ...(raw.hero             as object ?? {}) },
    action_card:      { ...SITE_CONTENT_DEFAULTS.action_card,      ...(raw.action_card      as object ?? {}) },
    features:         mergedFeatures,
    cta_section:      { ...SITE_CONTENT_DEFAULTS.cta_section,      ...(raw.cta_section      as object ?? {}) },
    statbot_preview:  { ...SITE_CONTENT_DEFAULTS.statbot_preview,  ...(raw.statbot_preview  as object ?? {}) },
    systems_overview: { ...SITE_CONTENT_DEFAULTS.systems_overview, ...(raw.systems_overview as object ?? {}) },
    ticker:           { ...SITE_CONTENT_DEFAULTS.ticker,           ...(raw.ticker           as object ?? {}) },
    model_picks:      { ...SITE_CONTENT_DEFAULTS.model_picks,      ...(raw.model_picks      as object ?? {}) },
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
  const { tier: userTier, isAdmin, isPaid, membership } = access

  return (
    <>
      {isAdmin ? (
        // Admin gets the interactive editor with a single pencil FAB
        // (LiveTicker is rendered inside HomeEditor for admins)
        <HomeEditor content={content} />
      ) : (
        // Everyone else gets static server-rendered sections
        // (the ticker is rendered globally by the root layout)
        <>
          <Hero            content={content.hero} isLoggedIn={userTier !== null} />
          <Features        content={content.features} />
          <SportsBand />
          <CTASection      content={content.cta_section} membership={membership} />
        </>
      )}
    </>
  )
}
