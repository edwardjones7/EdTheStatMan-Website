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

export interface SystemsOverviewCard {
  sport: 'nfl' | 'cfb' | 'nba' | 'cbb'
  name: string
  statusLabel: string
  statusType: 'ended' | 'active' | 'hot'
  wins: number
  losses: number
}

export interface SystemsOverviewContent {
  label: string
  title: string
  subtitle: string
  footerNote: string
  cards: SystemsOverviewCard[]
}

export interface TickerItem {
  tag: string         // e.g. "NFL"
  text: string        // e.g. "Betting Systems: 10-34"
  icon?: string       // optional emoji before tag, e.g. "🏈"
  badge?: string      // optional badge text, e.g. "▲ Hot"
  badgeType?: 'up' | 'down' | 'neutral'
}

export interface TickerContent {
  items: TickerItem[]
}

export interface ModelPicksContent {
  sectionLabel: string
  sectionTitle: string
  sectionSubtitle: string
}

export interface AllSiteContent {
  hero: HeroContent
  action_card: ActionCardContent
  features: FeaturesContent
  cta_section: CTAContent
  statbot_preview: StatBotContent
  systems_overview: SystemsOverviewContent
  ticker: TickerContent
  model_picks: ModelPicksContent
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
      title: 'Sharp Picks',
      text: 'Curated daily picks across NFL, NBA, College Football, and College Basketball. Every pick is backed by systems and trends data.',
      href: '/betting-systems',
      linkText: 'View Systems',
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
      text: 'Get notified the moment picks drop via X and Discord. Never miss an edge with real-time betting alerts.',
      href: 'https://x.com/EdTheStatMan',
      linkText: 'Join Now',
      iconColor: 'purple',
      isExternal: true,
    },
  ],
}

export const DEFAULT_CTA: CTAContent = {
  title: 'Get Every Pick.',
  titleAccent: 'Never Miss an Edge.',
  text: 'Follow us on X for instant notifications on all betting systems, picks, and trend alerts.',
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
  cards: [
    { sport: 'nfl',  name: 'NFL',                statusLabel: 'Season Ended', statusType: 'ended',  wins: 10,  losses: 34 },
    { sport: 'cfb',  name: 'College Football',    statusLabel: 'Season Ended', statusType: 'ended',  wins: 3,   losses: 3  },
    { sport: 'nba',  name: 'NBA',                 statusLabel: 'Active',       statusType: 'active', wins: 101, losses: 108 },
    { sport: 'cbb',  name: 'College Basketball',  statusLabel: 'Hot Streak',   statusType: 'hot',    wins: 2,   losses: 0  },
  ],
}

export const DEFAULT_MODEL_PICKS: ModelPicksContent = {
  sectionLabel: 'Daily Picks',
  sectionTitle: "What I'm Betting Today",
  sectionSubtitle: 'My active plays — updated daily.',
}

export const DEFAULT_TICKER: TickerContent = {
  items: [
    { tag: 'NFL',                icon: '🏈', text: 'Betting Systems: 10-34' },
    { tag: 'College Football',   icon: '🏈', text: 'Betting Systems: 3-3' },
    { tag: 'NBA',                icon: '🏀', text: 'Betting Systems: 101-108' },
    { tag: 'College Basketball', icon: '🏀', text: 'Betting Systems: 2-0',      badge: '▲ Hot',    badgeType: 'up' },
    { tag: 'Bankroll',           icon: '💰', text: '+10.19% in 2026',           badge: '▲',        badgeType: 'up' },
    { tag: 'Super Bowl LX',      icon: '🏆', text: 'Systems: 19-4 ATS',         badge: '✅ Winner', badgeType: 'up' },
  ],
}

// ── Results page ─────────────────────────────────────────────────────────────

export interface ResultsStatCard {
  count: string
  prefix: string
  suffix: string
  decimals: string
  label: string
}

export interface ResultsChartBar {
  color: 'green' | 'red'
  height: number
  value: string
}

export interface ResultsYearRow {
  year: string
  nfl: string
  cfb: string
  nba: string
  cbb: string
  overall: string
  bankroll: string
  bankrollType: 'win' | 'loss'
}

export interface ResultsContent {
  headerLabel: string
  headerTitle: string
  headerSubtitle: string
  statCards: ResultsStatCard[]
  chartTitle: string
  chartValue: string
  chartBars: ResultsChartBar[]
  tableLabel: string
  tableTitle: string
  tableSubtitle: string
  tableRows: ResultsYearRow[]
}

export const DEFAULT_RESULTS: ResultsContent = {
  headerLabel: 'Historical Performance',
  headerTitle: 'Results',
  headerSubtitle: 'Full transparency on our betting systems. Track our year-by-year performance, bankroll ROI, and sport-by-sport records.',
  statCards: [
    { count: '10.19', prefix: '+', suffix: '%',      decimals: '2', label: 'Total Bankroll' },
    { count: '19',    prefix: '',  suffix: '-4 ATS',  decimals: '0', label: 'Super Bowl Record' },
    { count: '4',     prefix: '',  suffix: ' Sports', decimals: '0', label: 'Total Systems Tracked' },
    { count: '2026',  prefix: '',  suffix: '',         decimals: '0', label: 'Year' },
  ],
  chartTitle: '2026 Bankroll Performance',
  chartValue: '+10.19%',
  chartBars: [
    { color: 'green', height: 100, value: '+3.2%' },
    { color: 'red',   height: 56,  value: '+1.8%' },
    { color: 'green', height: 5,   value: '—' },
    { color: 'red',   height: 5,   value: '—' },
    { color: 'green', height: 5,   value: '—' },
    { color: 'red',   height: 5,   value: '—' },
    { color: 'green', height: 5,   value: '—' },
    { color: 'red',   height: 5,   value: '—' },
    { color: 'green', height: 5,   value: '—' },
    { color: 'red',   height: 5,   value: '—' },
    { color: 'green', height: 5,   value: '—' },
    { color: 'red',   height: 5,   value: '—' },
  ],
  tableLabel: 'Year-by-Year',
  tableTitle: 'Historical Results',
  tableSubtitle: 'Complete records across NFL, College Football, NBA, and College Basketball.',
  tableRows: [
    { year: '2026', nfl: '10-34',  cfb: '3-3',   nba: '101-108', cbb: '2-0',   overall: '116-145', bankroll: '+10.19%', bankrollType: 'win' },
    { year: '2025', nfl: '44-38',  cfb: '12-8',  nba: '198-182', cbb: '15-10', overall: '269-238', bankroll: '+15.2%',  bankrollType: 'win' },
    { year: '2024', nfl: '38-42',  cfb: '8-12',  nba: '175-195', cbb: '12-14', overall: '233-263', bankroll: '-4.8%',   bankrollType: 'loss' },
  ],
}

export const SITE_CONTENT_DEFAULTS: AllSiteContent = {
  hero: DEFAULT_HERO,
  action_card: DEFAULT_ACTION_CARD,
  features: DEFAULT_FEATURES,
  cta_section: DEFAULT_CTA,
  statbot_preview: DEFAULT_STATBOT,
  systems_overview: DEFAULT_SYSTEMS_OVERVIEW,
  ticker: DEFAULT_TICKER,
  model_picks: DEFAULT_MODEL_PICKS,
}
