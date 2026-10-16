import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import PickViewTracker from '@/components/PickViewTracker'
import { ResultBadge } from '@/components/PickCard'
import { loadPick, pickHeadline, type PublicPick } from '@/lib/picks/public'
import { formatOdds } from '@/lib/picks/slug'
import { xPostUrl } from '@/lib/x'
import { formatCardDate } from '@/lib/brief'
import '@/styles/picks.css'

const BASE = 'https://edthestatman.com'

// Same as /picks: the page is the same for every visitor, so it is cached, and
// admin saves and grades clear it at once (lib/picks/revalidate.ts).
export const revalidate = 300

const MARKET_LABEL: Record<string, string> = {
  spread: 'Spread', total: 'Total', moneyline: 'Moneyline', prop: 'Player prop', other: 'Pick',
}

/** Slugs are plain [a-z0-9-]; anything that will not decode is simply not one. */
function safeDecode(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}

function cardDate(date: string | null): string {
  if (!date) return ''
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatCardDate(date) : date
}

function postedLabel(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short',
  })
}

function titleOf(p: PublicPick): string {
  if (p.locked) return `${p.sport} members' pick, ${cardDate(p.date)}`
  const price = formatOdds(p.odds)
  return `${p.sport} pick: ${p.bet}${price ? ` (${price})` : ''}${p.opponent ? ` vs ${p.opponent}` : ''}`
}

function descriptionOf(p: PublicPick): string {
  const when = cardDate(p.date)
  const graded = p.result === 'pending' ? '' : ` Graded: ${p.result}.`
  if (p.locked) return `A members' ${p.sport} pick for ${when}. The pick is revealed here once the game is graded.`
  return `Ed's ${p.free ? 'free ' : ''}${p.sport} pick for ${when}: ${p.bet}.${graded}`
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const found = await loadPick(safeDecode(params.slug))
  if (!found) return { title: 'Pick Not Found', robots: { index: false } }
  const { pick } = found
  const url = `${BASE}/picks/${encodeURIComponent(pick.key)}`
  const title = titleOf(pick)
  const description = descriptionOf(pick)
  return {
    title,
    description,
    alternates: { canonical: url },
    // A locked, ungraded members' pick is a sport, a date and a lock: thin
    // content. Kept out of the index (and the sitemap) until it is graded.
    robots: pick.locked ? { index: false, follow: true } : undefined,
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: 'EdTheStatMan',
      publishedTime: pick.postedAt ?? undefined,
      modifiedTime: pick.updatedAt ?? undefined,
      images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-cover.jpg'] },
  }
}

export default async function PickPage({ params }: { params: { slug: string } }) {
  const requested = safeDecode(params.slug)
  const found = await loadPick(requested)
  if (!found) notFound()
  const { pick, canonicalKey } = found

  // Reached by id while the pick has a slug: send the link to its one URL, so
  // search engines and shares settle on a single address.
  if (canonicalKey !== requested) permanentRedirect(`/picks/${encodeURIComponent(canonicalKey)}`)

  const url = `${BASE}/picks/${encodeURIComponent(pick.key)}`
  const price = formatOdds(pick.odds)
  const posted = postedLabel(pick.postedAt)
  const headline = pickHeadline(pick)

  // Article is the honest type: this is a dated, authored post about one
  // pick. Nothing here is a product, an offer or a review, so no markup claims
  // to be one.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: titleOf(pick).slice(0, 110),
    description: descriptionOf(pick),
    datePublished: pick.postedAt ?? undefined,
    dateModified: pick.updatedAt ?? pick.postedAt ?? undefined,
    author: { '@type': 'Organization', name: 'EdTheStatMan', url: BASE },
    publisher: { '@type': 'Organization', name: 'EdTheStatMan', url: BASE },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    articleSection: pick.sport,
    isAccessibleForFree: !pick.locked,
  }

  return (
    <main className="picks-page">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <PickViewTracker pickId={pick.id} sport={pick.sport} free={pick.free} locked={pick.locked} />

      <section className="section pick-detail">
        <div className="container pick-detail__container">
          <nav className="pick-detail__crumb" aria-label="Breadcrumb">
            <Link href="/picks">&larr; Free picks</Link>
          </nav>

          <article className={`pick-detail__card ${pick.locked ? 'pick-detail__card--locked' : ''}`}>
            <div className="pick-detail__meta">
              <span className={`pick-sport pick-sport--${pick.sport.toLowerCase()}`}>{pick.sport}</span>
              <span>{cardDate(pick.date)}</span>
              <span className="pick-detail__book">{pick.free ? 'Free pick' : "Members' pick"}</span>
            </div>

            <h1 className="pick-detail__bet">
              {pick.locked ? 'Locked until graded' : headline}
            </h1>

            {!pick.locked && (
              <dl className="pick-detail__facts">
                {price && (<><dt>Price</dt><dd>{price}</dd></>)}
                {pick.opponent && (<><dt>Opponent</dt><dd>{pick.opponent}</dd></>)}
                {pick.market && (<><dt>Market</dt><dd>{MARKET_LABEL[pick.market] ?? pick.market}</dd></>)}
              </dl>
            )}

            <div className="pick-detail__result">
              <ResultBadge result={pick.result} />
              {pick.result === 'pending' && <span className="pick-detail__muted">Graded after the game.</span>}
            </div>

            {pick.note && <div className="pick-detail__note">{pick.note}</div>}

            <div className="pick-detail__foot">
              {posted && <span className="pick-detail__muted">Posted {posted}</span>}
              {pick.xPostId && !pick.locked && (
                <a href={xPostUrl(pick.xPostId)} target="_blank" rel="noopener noreferrer" className="pick-detail__x">
                  See the original post on X &rarr;
                </a>
              )}
            </div>
          </article>

          {pick.locked ? (
            <div className="picks-upsell">
              <p>
                This one is on the members&apos; card. Members see it now; everyone sees it here once the game is graded,
                because every graded pick stays on the public record.
              </p>
              <Link href="/win" className="btn btn--primary">See the plans</Link>
            </div>
          ) : (
            <div className="picks-signup">
              <div>
                <h2 className="picks-signup__title">Get Ed&apos;s next free pick</h2>
                <p className="picks-signup__text">A free account gets an alert when Ed posts a free pick, plus the free systems.</p>
              </div>
              <Link href="/signup?next=/picks" className="btn btn--primary">Create a free account</Link>
            </div>
          )}

          <p className="picks-more">
            <Link href="/picks">All free picks and the record</Link>
            {' · '}
            <Link href="/portfolio/performance">See every pick</Link>
          </p>
        </div>
      </section>
    </main>
  )
}
