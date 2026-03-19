import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import type { AllSiteContent } from '@/lib/site-content'
import LiveTicker from '@/components/LiveTicker'
import Hero from '@/components/Hero'
import TodaysBets from '@/components/TodaysBets'
import type { TodaysBet } from '@/components/TodaysBets'
import SystemsOverview from '@/components/SystemsOverview'
import Features from '@/components/Features'
import CTASection from '@/components/CTASection'
import HomeEditor from '@/components/HomeEditor'

export const metadata: Metadata = {
  title: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
  description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win. Data-driven NFL, NBA, college football & basketball.',
  alternates: { canonical: 'https://edthestatman.com' },
  openGraph: {
    title: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
    description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win. Data-driven NFL, NBA, college football & basketball.',
    url: 'https://edthestatman.com',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
    description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win.',
    images: ['/opengraph-image'],
  },
}

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = await createClient()
  const adminDb  = createAdminClient()

  const [contentResult, betsResult] = await Promise.all([
    (supabase as any).from('site_content').select('key, value'),
    (adminDb  as any).from('todays_bets').select('*').order('created_at', { ascending: false }),
  ])

  const { data: contentRows } = contentResult
  const todaysBets: TodaysBet[] = betsResult.data ?? []

  const raw: Record<string, unknown> = {}
  for (const row of (contentRows ?? []) as { key: string; value: unknown }[]) {
    raw[row.key] = row.value
  }

  const content: AllSiteContent = {
    hero:             { ...SITE_CONTENT_DEFAULTS.hero,             ...(raw.hero             as object ?? {}) },
    action_card:      { ...SITE_CONTENT_DEFAULTS.action_card,      ...(raw.action_card      as object ?? {}) },
    features:         { ...SITE_CONTENT_DEFAULTS.features,         ...(raw.features         as object ?? {}) },
    cta_section:      { ...SITE_CONTENT_DEFAULTS.cta_section,      ...(raw.cta_section      as object ?? {}) },
    statbot_preview:  { ...SITE_CONTENT_DEFAULTS.statbot_preview,  ...(raw.statbot_preview  as object ?? {}) },
    systems_overview: { ...SITE_CONTENT_DEFAULTS.systems_overview, ...(raw.systems_overview as object ?? {}) },
    ticker:           { ...SITE_CONTENT_DEFAULTS.ticker,           ...(raw.ticker           as object ?? {}) },
  }

  let isAdmin = false
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = !!(profile as any)?.is_admin
  }

  return (
    <>
      <LiveTicker />
      {isAdmin ? (
        // Admin gets the interactive editor with a single pencil FAB
        // (LiveTicker is rendered inside HomeEditor for admins)
        <HomeEditor content={content} todaysBets={todaysBets} />
      ) : (
        // Everyone else gets static server-rendered sections
        <>
          <LiveTicker      content={content.ticker} />
          <Hero            content={content.hero} />
          <TodaysBets      rows={todaysBets} isAdmin={isAdmin} />
          <SystemsOverview content={content.systems_overview} />
          <Features        content={content.features} />
          <CTASection      content={content.cta_section} />
        </>
      )}
    </>
  )
}
