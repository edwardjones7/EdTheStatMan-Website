import type { Metadata } from 'next'
import { Inter, Outfit, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import Navigation from '@/components/Navigation'
import Footer from '@/components/Footer'
import BackgroundEffects from '@/components/BackgroundEffects'
import BackToTop from '@/components/BackToTop'
import ClientScripts from '@/components/ClientScripts'

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
  title: 'EdTheStatMan.com – Winning Sports Betting Picks, Systems & Trends',
  description: 'Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win.',
  keywords: 'sports betting, betting systems, betting trends, handicapping, NFL, NBA, college football, college basketball',
  openGraph: {
    type: 'website',
    siteName: 'EdTheStatMan',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
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
        <link rel="canonical" href="https://edwardjones7.github.io/EdTheStatMan-Website/" />
        <meta name="robots" content="index, follow" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://edwardjones7.github.io/EdTheStatMan-Website/#organization",
                  "name": "EdTheStatMan",
                  "url": "https://edwardjones7.github.io/EdTheStatMan-Website/",
                  "description": "Winning sports betting picks, systems and trends. Where handicappers get sharp and bettors win.",
                  "sameAs": ["https://t.me/edthestatman", "https://discord.gg/gqPrVBg4Aw"]
                },
                {
                  "@type": "WebSite",
                  "@id": "https://edwardjones7.github.io/EdTheStatMan-Website/#website",
                  "url": "https://edwardjones7.github.io/EdTheStatMan-Website/",
                  "name": "EdTheStatMan",
                  "publisher": { "@id": "https://edwardjones7.github.io/EdTheStatMan-Website/#organization" },
                  "description": "Data-driven betting systems and trends for NFL, NBA, College Football, and College Basketball."
                }
              ]
            })
          }}
        />
      </head>
      <body>
        <BackgroundEffects />
        <Navigation />
        {children}
        <Footer />
        <BackToTop />
        <ClientScripts />
      </body>
    </html>
  )
}
