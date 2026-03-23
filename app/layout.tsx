import type { Metadata } from 'next'
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import BackgroundEffects from '@/components/BackgroundEffects'
import BackToTop from '@/components/BackToTop'
import ClientScripts from '@/components/ClientScripts'
import PageViewTracker from '@/components/PageViewTracker'
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
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'EdTheStatMan – Winning Sports Betting Picks, Systems & Trends' }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: 'https://edthestatman.com',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
                  "sameAs": ["https://t.me/edthestatman", "https://discord.gg/gqPrVBg4Aw"]
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
      </head>
      <body>
        <BackgroundEffects />
        <Suspense>
          <Navigation />
        </Suspense>
        {children}
        <Footer />
        <BackToTop />
        <ClientScripts />
        <Suspense><PageViewTracker /></Suspense>
      </body>
    </html>
  )
}
