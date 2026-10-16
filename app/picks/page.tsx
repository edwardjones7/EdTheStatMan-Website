import type { Metadata } from 'next'
import Link from 'next/link'
import PickCard from '@/components/PickCard'
import PickRecords from '@/components/PickRecords'
import { loadPicksData } from '@/lib/picks/public'
import { formatCardDate } from '@/lib/brief'
import '@/styles/picks.css'

const URL = 'https://edthestatman.com/picks'
const DESCRIPTION = "Ed's free picks, props included, every one graded. The free record and the members' record, side by side."

export const metadata: Metadata = {
  title: 'Free Picks',
  description: DESCRIPTION,
  alternates: { canonical: URL },
  openGraph: {
    title: 'Free Picks – EdTheStatMan.com',
    description: DESCRIPTION,
    url: URL,
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free Picks – EdTheStatMan.com',
    description: DESCRIPTION,
    images: ['/og-cover.jpg'],
  },
}

// Nothing here depends on who is looking, so the page is cached and rebuilt
// at most every few minutes. Saving, approving or grading a pick clears it at
// once (lib/picks/revalidate.ts); this is only the backstop.
export const revalidate = 300

export default async function FreePicksPage() {
  const { records, upcomingFree, recentFree, upcomingMembers, today } = await loadPicksData()

  // Group the open picks by card date, the way Ed posts them.
  const byDate = new Map<string, typeof upcomingFree>()
  for (const p of upcomingFree) {
    const d = p.date ?? today
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(p)
  }

  return (
    <main className="picks-page">
      <header className="page-header">
        <div className="container">
          <span className="section-label">Free Picks</span>
          <h1 className="page-header__title">Ed&apos;s free picks, graded</h1>
          <p className="page-header__subtitle">
            Sides, totals and player props, straight from Ed. Every pick stays on the record once it is graded, win or lose.
          </p>
        </div>
      </header>

      <section className="section picks-section">
        <div className="container">
          <h2 className="picks-h2">Open picks</h2>
          {byDate.size === 0 ? (
            <p className="picks-empty">No open free picks right now. New ones land here as Ed posts them.</p>
          ) : (
            [...byDate.entries()].map(([date, picks]) => (
              <div key={date} className="picks-day">
                <h3 className="picks-day__title">{/^\d{4}-\d{2}-\d{2}$/.test(date) ? formatCardDate(date) : date}</h3>
                <div className="picks-grid">
                  {picks.map(p => <PickCard key={p.id} pick={p} />)}
                </div>
              </div>
            ))
          )}

          {upcomingMembers > 0 && (
            <div className="picks-upsell">
              <p>
                <strong>{upcomingMembers}</strong> more {upcomingMembers === 1 ? 'pick is' : 'picks are'} on the members&apos; card.
                Members&apos; picks are revealed here once they are graded.
              </p>
              <Link href="/win" className="btn btn--outline">See the plans</Link>
            </div>
          )}

          <div className="picks-signup">
            <div>
              <h3 className="picks-signup__title">Get the next one when Ed posts it</h3>
              <p className="picks-signup__text">A free account gets an alert when Ed posts a free pick, plus the free systems.</p>
            </div>
            <Link href="/signup?next=/picks" className="btn btn--primary">Create a free account</Link>
          </div>
        </div>
      </section>

      <section className="section picks-section picks-section--alt">
        <div className="container">
          <h2 className="picks-h2">The record</h2>
          <PickRecords rows={records} />
        </div>
      </section>

      <section className="section picks-section">
        <div className="container">
          <h2 className="picks-h2">Recently graded free picks</h2>
          {recentFree.length === 0 ? (
            <p className="picks-empty">Nothing graded yet.</p>
          ) : (
            <div className="picks-grid">
              {recentFree.map(p => <PickCard key={p.id} pick={p} />)}
            </div>
          )}
          <p className="picks-more">
            <Link href="/portfolio/performance">See every pick &rarr;</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
