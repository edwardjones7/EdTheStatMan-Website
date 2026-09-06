import type { Metadata } from 'next'
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import BackgroundEffects from '@/components/BackgroundEffects'
import BackToTop from '@/components/BackToTop'
import ClientScripts from '@/components/ClientScripts'
import PageViewTracker from '@/components/PageViewTracker'
import GlobalTicker from '@/components/GlobalTicker'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_TICKER } from '@/lib/site-content'
import type { TickerContent } from '@/lib/site-content'
import { Suspense } from 'react'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const outfit = Outfit({ 
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-outfit',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://edthestatman.com'),
  title: {
    default: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
    template: '%s – EdTheStatMan.com',
  },
  description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win.',
  keywords: 'sports betting, betting systems, betting trends, handicapping, NFL, NBA, college football, college basketball',
  openGraph: {
    type: 'website',
    siteName: 'EdTheStatMan',
    locale: 'en_US',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630, alt: 'EdTheStatMan – Winning Sports Betting Picks, Systems & Trends' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-cover.jpg'],
  },
  alternates: {
    canonical: 'https://edthestatman.com',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // A single global ticker is rendered on every route (including home) so it
  // stays uniform and survives client-side navigation. Admins can edit it in
  // place from any page via GlobalTicker.
  const supabase = await createClient()

  const { data: tickerRow } = await (supabase as any)
    .from('site_content')
    .select('value')
    .eq('key', 'ticker')
    .single()
  const ticker: TickerContent = { ...DEFAULT_TICKER, ...((tickerRow?.value as object) ?? {}) }

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
    <html lang="en" className={`${inter.variable} ${outfit.variable} ${jetbrainsMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://edthestatman.com#organization",
                  "name": "EdTheStatMan",
                  "url": "https://edthestatman.com",
                  "description": "Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win.",
                  "sameAs": ["https://x.com/EdTheStatMan", "https://discord.gg/rXBZkSPcJb"]
                },
                {
                  "@type": "WebSite",
                  "@id": "https://edthestatman.com#website",
                  "url": "https://edthestatman.com",
                  "name": "EdTheStatMan",
                  "publisher": { "@id": "https://edthestatman.com#organization" },
                  "description": "Data-driven betting systems and trends for NFL, NBA, College Football, and College Basketball."
                }
              ]
            })
          }}
        />
        {/* -webkit-text-size-adjust, inlined ON PURPOSE.

            Autoprefixer STRIPS this one property from globals.css. Verified
            against the production bundle: every other -webkit- prefix in the
            stylesheet survives -- mask-image, overflow-scrolling,
            font-smoothing, user-select -- and only -webkit-text-size-adjust is
            removed. iOS Safari supports ONLY the prefixed form, so the rule was
            being deleted before it ever reached a phone, which is why three
            rounds of fixing the ticker changed nothing on mobile.

            Inlined here because this <style> is emitted verbatim and never
            passes through PostCSS. Keep the unprefixed copies in globals.css for
            Chrome and Firefox; this is the Safari half.

            'none' is scoped to the ticker only -- a decorative marquee nobody
            needs to enlarge. Everything else stays at 100%, which preserves the
            reader's own text scaling. */}
        <style
          dangerouslySetInnerHTML={{
            __html:
              'html{-webkit-text-size-adjust:100%}' +
              '.ticker,.ticker *{-webkit-text-size-adjust:none}',
          }}
        />
      </head>
      <body>
        <BackgroundEffects />
        <Suspense>
          <Navigation />
        </Suspense>
        <GlobalTicker content={ticker} isAdmin={isAdmin} />
        {/* Reserve flow space for the fixed ticker so page content clears it. */}
        <div className="ticker-spacer" aria-hidden />
        {children}
        <Footer />
        <BackToTop />
        <ClientScripts />
        <Suspense><PageViewTracker /></Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
