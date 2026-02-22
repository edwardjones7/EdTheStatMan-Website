import type { Metadata } from 'next'
import Link from 'next/link'
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

export default function Home() {
  return (
    <>
      <LiveTicker />
      <Hero />
      <ActionCard />
      <SystemsOverview />
      <Features />
      <StatBotPreview />
      <CTASection />
    </>
  )
}
