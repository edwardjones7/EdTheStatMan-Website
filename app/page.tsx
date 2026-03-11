import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SITE_CONTENT_DEFAULTS } from '@/lib/site-content'
import type { AllSiteContent } from '@/lib/site-content'
import LiveTicker from '@/components/LiveTicker'
import Hero from '@/components/Hero'
import ActionCard from '@/components/ActionCard'
import SystemsOverview from '@/components/SystemsOverview'
import Features from '@/components/Features'
import StatBotPreview from '@/components/StatBotPreview'
import CTASection from '@/components/CTASection'

export const metadata: Metadata = {
  title: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
  description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win. Data-driven NFL, NBA, college football & basketball.',
  openGraph: {
    title: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
    description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win.',
    url: 'https://edwardjones7.github.io/EdTheStatMan-Website/',
  },
  twitter: {
    title: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
    description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win.',
  },
}

export default async function Home() {
  const supabase = await createClient()

  // Fetch site content (gracefully falls back to defaults if table missing)
  const { data: contentRows } = await (supabase as any)
    .from('site_content')
    .select('key, value')

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
  }

  // Check if current user is admin
  let isAdmin = false
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single()
    isAdmin = !!(profile as any)?.is_admin
  }

  return (
    <>
      <LiveTicker />
      <Hero content={content.hero} isAdmin={isAdmin} />
      <ActionCard content={content.action_card} isAdmin={isAdmin} />
      <SystemsOverview content={content.systems_overview} isAdmin={isAdmin} />
      <Features content={content.features} isAdmin={isAdmin} />
      <StatBotPreview content={content.statbot_preview} isAdmin={isAdmin} />
      <CTASection content={content.cta_section} isAdmin={isAdmin} />
    </>
  )
}
