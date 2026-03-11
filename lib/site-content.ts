// Types and default values for editable page content.
// Run this SQL in Supabase before using:
//
//   CREATE TABLE IF NOT EXISTS site_content (
//     key         TEXT PRIMARY KEY,
//     value       JSONB NOT NULL DEFAULT '{}',
//     updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );
//   ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;
//   CREATE POLICY "Public read" ON site_content FOR SELECT USING (true);
//   CREATE POLICY "Admin write" ON site_content FOR ALL
//     USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

export interface FeatureCard {
  number: string
  title: string
  text: string
  href: string
  linkText: string
  iconColor: 'cyan' | 'purple' | 'green' | 'gold'
  isExternal?: boolean
}

export interface HeroContent {
  badge: string
  title: string
  titleAccent: string
  description: string
  stat1Count: string
  stat1Prefix: string
  stat1Suffix: string
  stat1Decimals: string
  stat1Label: string
  stat2Count: string
  stat2Suffix: string
  stat2Label: string
  stat3Count: string
  stat3Suffix: string
  stat3Label: string
}

export interface ActionCardContent {
  sectionLabel: string
  sectionTitle: string
  sectionSubtitle: string
  dateHeader: string
  statusLabel: string
  statusType: 'final' | 'active' | 'upcoming'
  message: string
  highlight: string
  bankroll: string
}

export interface FeaturesContent {
  label: string
  title: string
  titleAccent: string
  titleSuffix: string
  subtitle: string
  cards: FeatureCard[]
}

export interface CTAContent {
  title: string
  titleAccent: string
  text: string
}

export interface StatBotContent {
  label: string
  title: string
  titleAccent: string
  description: string
  bullets: string[]
}

export interface SystemsOverviewContent {
  label: string
  title: string
  subtitle: string
  footerNote: string
}

export interface AllSiteContent {
  hero: HeroContent
  action_card: ActionCardContent
  features: FeaturesContent
  cta_section: CTAContent
  statbot_preview: StatBotContent
  systems_overview: SystemsOverviewContent
}

export const DEFAULT_HERO: HeroContent = {
  badge: 'Systems Active — Basketball Season',
  title: 'Winning Trends.',
  titleAccent: 'Proven Systems.',
  description:
    'Where handicappers get sharp and bettors win. Data-driven betting systems and trends backed by deep statistical analysis.',
  stat1Count: '10.19',
  stat1Prefix: '+',
  stat1Suffix: '%',
  stat1Decimals: '2',
  stat1Label: '2026 Bankroll',
  stat2Count: '19',
  stat2Suffix: '-4',
  stat2Label: 'Super Bowl LX Systems',
  stat3Count: '4',
  stat3Suffix: ' Sports',
  stat3Label: 'Active Leagues',
}

export const DEFAULT_ACTION_CARD: ActionCardContent = {
  sectionLabel: "Today's Action",
  sectionTitle: 'Monday February 16th, 2026',
  sectionSubtitle:
    'Stay updated with the latest picks, active systems, and daily analysis.',
  dateHeader: 'Monday, February 16th 2026 — Final Update',
  statusLabel: 'Final Update',
  statusType: 'final',
  message:
    'No Betting Systems are active on Monday. Check back tomorrow for updated systems and picks.',
  highlight:
    'Super Bowl LX Betting Systems were 19-4 ATS, and 17-1 ATS in the Super Bowl — both proved to be winners with the Seahawks.',
  bankroll: 'Bankroll stands at +10.19% for 2026.',
}

export const DEFAULT_FEATURES: FeaturesContent = {
  label: 'What We Offer',
  title: 'Your',
  titleAccent: 'Edge',
  titleSuffix: 'Starts Here',
  subtitle: 'Data-driven tools and analysis to make smarter sports betting decisions.',
  cards: [
    {
      number: '01',
      title: 'Betting Systems',
      text: 'Proven, data-backed betting systems across NFL, College Football, NBA, and College Basketball. Updated daily with live records.',
      href: '/betting-systems',
      linkText: 'Explore Systems',
      iconColor: 'cyan',
    },
    {
      number: '02',
      title: 'Betting Trends',
      text: 'Team-by-team trend analysis for every major sport. Discover ATS records, over/under patterns, and situational edges.',
      href: '/betting-trends',
      linkText: 'View Trends',
      iconColor: 'purple',
    },
    {
      number: '03',
      title: 'EdTheStatBot',
      text: 'Ask questions about our database and get instant statistical insights. AI-powered analysis at your fingertips.',
      href: '/betting-systems',
      linkText: 'Learn More',
      iconColor: 'green',
    },
    {
      number: '04',
      title: 'Proven Results',
      text: 'Full transparency with historical performance records. Track our systems and verify our track record over time.',
      href: '/results',
      linkText: 'See Results',
      iconColor: 'gold',
    },
    {
      number: '05',
      title: 'Expert Blog',
      text: 'In-depth articles explaining key systems, trend breakdowns, and educational content to sharpen your handicapping skills.',
      href: '/blog',
      linkText: 'Read Blog',
      iconColor: 'cyan',
    },
    {
      number: '06',
      title: 'Instant Alerts',
      text: 'Get notified the moment picks drop via Telegram and Discord. Never miss an edge with real-time betting alerts.',
      href: 'https://t.me/edthestatman',
      linkText: 'Join Now',
      iconColor: 'purple',
      isExternal: true,
    },
  ],
}

export const DEFAULT_CTA: CTAContent = {
  title: 'Get Every Pick.',
  titleAccent: 'Never Miss an Edge.',
  text: 'Join our Telegram channel for instant notifications on all betting systems, picks, and trend alerts.',
}

export const DEFAULT_STATBOT: StatBotContent = {
  label: 'Coming Soon',
  title: 'Meet',
  titleAccent: 'EdTheStatBot',
  description:
    'Ask questions. Get answers. Our AI-powered statistical assistant lets you query our entire database for trends, records, and insights across every sport we cover.',
  bullets: [
    'Query team ATS records in any situation',
    'Find over/under trends by team and venue',
    'Discover edges with custom filters',
    'Natural language — no coding required',
  ],
}

export const DEFAULT_SYSTEMS_OVERVIEW: SystemsOverviewContent = {
  label: 'Active Systems',
  title: '2026 Betting Systems',
  subtitle: 'Real-time records across all active sports. Basketball systems are posted daily.',
  footerNote: 'Records based on calendar year 2026',
}

export const SITE_CONTENT_DEFAULTS: AllSiteContent = {
  hero: DEFAULT_HERO,
  action_card: DEFAULT_ACTION_CARD,
  features: DEFAULT_FEATURES,
  cta_section: DEFAULT_CTA,
  statbot_preview: DEFAULT_STATBOT,
  systems_overview: DEFAULT_SYSTEMS_OVERVIEW,
}
