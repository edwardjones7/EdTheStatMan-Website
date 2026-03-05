'use client'

import { useState } from 'react'

type SportFilter = 'all' | 'nfl' | 'nba' | 'cfb' | 'cbb'

const TABS: { label: string; value: SportFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'NFL', value: 'nfl' },
  { label: 'NBA', value: 'nba' },
  { label: 'College Football', value: 'cfb' },
  { label: 'College Basketball', value: 'cbb' },
]

const POSTS = [
  {
    sport: 'nfl',
    imageClass: 'blog-card__image--nfl',
    icon: '🏈',
    tag: 'NFL',
    title: 'Super Bowl LX Systems: How We Went 19-4 ATS',
    excerpt: 'A deep dive into our Super Bowl LX betting systems that delivered a dominant 19-4 against the spread record. We break down which systems hit and why the Seahawks proved to be the right side.',
    date: 'Feb 10, 2026',
  },
  {
    sport: 'nba',
    imageClass: 'blog-card__image--nba',
    icon: '🏀',
    tag: 'NBA',
    title: 'NBA Mid-Season Trends: 5 Systems That Are Printing Money',
    excerpt: 'Five NBA betting systems that have been crushing it through the first half of the season. From home underdogs to back-to-back spots, we reveal what\'s working right now.',
    date: 'Feb 8, 2026',
  },
  {
    sport: 'education',
    imageClass: 'blog-card__image--education',
    icon: '📚',
    tag: 'Education',
    title: 'Understanding ATS Records: A Beginner\'s Guide',
    excerpt: 'New to sports betting? Learn what "against the spread" means, how ATS records are calculated, and why they matter more than straight-up wins when evaluating betting systems.',
    date: 'Feb 5, 2026',
  },
  {
    sport: 'cbb',
    imageClass: 'blog-card__image--cbb',
    icon: '🏀',
    tag: 'College Basketball',
    title: 'March Madness Preview: Early Trends to Watch',
    excerpt: 'With conference play heating up, we identify the early trends that could shape March Madness betting. Seed differentials, pace factors, and CBB-specific systems to monitor.',
    date: 'Feb 3, 2026',
  },
  {
    sport: 'strategy',
    imageClass: 'blog-card__image--strategy',
    icon: '💰',
    tag: 'Strategy',
    title: 'Bankroll Management: How to Protect Your Edge',
    excerpt: 'Having an edge means nothing if you can\'t survive variance. Learn unit sizing, Kelly criterion basics, and practical bankroll management strategies that keep you in the game.',
    date: 'Jan 28, 2026',
  },
  {
    sport: 'nfl',
    imageClass: 'blog-card__image--nfl-alt',
    icon: '🏈',
    tag: 'NFL',
    title: '2025 NFL Season Recap: Lessons from Our Betting Systems',
    excerpt: 'Looking back at the 2025 NFL season: which systems performed, which underperformed, and the key lessons we\'re carrying into next year\'s handicapping approach.',
    date: 'Jan 20, 2026',
  },
]

export default function BlogFilter() {
  const [activeTab, setActiveTab] = useState<SportFilter>('all')

  const visible = POSTS.filter(p => activeTab === 'all' || p.sport === activeTab)

  return (
    <>
      <div className="sport-tabs reveal" style={{ marginTop: '32px' }}>
        {TABS.map(tab => (
          <button
            key={tab.value}
            className={`sport-tab${activeTab === tab.value ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="blog-grid stagger-children" style={{ marginTop: '40px' }}>
        {visible.map(post => (
          <article key={post.title} className="blog-card reveal-scale">
            <div className={`blog-card__image ${post.imageClass}`}>{post.icon}</div>
            <div className="blog-card__body">
              <span className="blog-card__tag">{post.tag}</span>
              <h3 className="blog-card__title">{post.title}</h3>
              <p className="blog-card__excerpt">{post.excerpt}</p>
              <div className="blog-card__meta">
                <span>{post.date}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  )
}
