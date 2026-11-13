'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LIVE_SPORTS, LIVE_SPORT_LABEL, type LiveSport } from '@/lib/live/types'
import type { NewsEntry } from '@/lib/home-feeds'

function ago(iso: string | null, now: number): string {
  if (!iso) return ''
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

/**
 * League headlines, linked out to ESPN. Headline and ESPN's own one-line
 * summary only, never the story itself (lib/feeds/news.ts). A story that names
 * a Desk game links to it as well, with the line.
 */
export default function NewsCard({ news }: { news: NewsEntry[] }) {
  const tabs = LIVE_SPORTS.filter(s => news.some(n => n.sport === s))
  const [tab, setTab] = useState<LiveSport | 'all'>('all')
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (news.length === 0) return null
  const list = (tab === 'all'
    ? [...news].sort((a, b) => String(b.published ?? '').localeCompare(String(a.published ?? '')))
    : news.filter(n => n.sport === tab)
  ).slice(0, 8)

  return (
    <section className="front-card">
      <header className="front-hd">
        <h2>Latest news</h2>
        <div className="front-tabs" role="tablist" aria-label="League">
          {(['all', ...tabs] as const).map(s => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={tab === s}
              className={`front-strip__tab${tab === s ? ' is-on' : ''}`}
              onClick={() => setTab(s)}
            >
              {s === 'all' ? 'All' : LIVE_SPORT_LABEL[s]}
            </button>
          ))}
        </div>
      </header>
      <ul className="front-news">
        {list.map(n => (
          <li key={n.id}>
            <a href={n.url} target="_blank" rel="noopener noreferrer" className="front-news__link">
              <span className="front-news__meta">
                <span className="front-tag">{LIVE_SPORT_LABEL[n.sport]}</span>
                {now != null && <span>{ago(n.published, now)}</span>}
              </span>
              <b>{n.headline}</b>
              {n.description && <span className="front-news__dek">{n.description}</span>}
            </a>
            <span className="front-news__foot">
              <span className="front-dim">via ESPN</span>
              {n.game && <Link href={n.game.href} className="front-news__game">{n.game.label} · Research Desk</Link>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
