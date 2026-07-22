'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { AccessLevel } from '@/lib/supabase/types'
import { IconLock } from './Icons'
import { coverForPost } from '@/lib/blog-images'

const POSTS_PER_PAGE = 12

const FILTER_TABS = [
  { label: 'All', value: 'all' },
  { label: 'NFL', value: 'NFL' },
  { label: 'NBA', value: 'NBA' },
  { label: 'CFB', value: 'College Football' },
  { label: 'CBB', value: 'College Basketball' },
  { label: 'Education', value: 'Education' },
  { label: 'Strategy', value: 'Strategy' },
]

export interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  tag: string
  access_level: AccessLevel
  published_at: string | null
  cover_image?: string | null
}

interface Props {
  posts: BlogPost[]
  userTier: string | null
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function BlogFilter({ posts, userTier }: Props) {
  const [activeTab, setActiveTab] = useState('all')
  const [page, setPage] = useState(1)

  const isPaid = userTier === 'basic' || userTier === 'premium'

  const filtered = posts.filter(p => activeTab === 'all' || p.tag === activeTab)
  const totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE)
  const visible = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE)

  function handleTabChange(val: string) {
    setActiveTab(val)
    setPage(1)
  }

  if (posts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        No posts published yet. Check back soon.
      </div>
    )
  }

  return (
    <>
      <div className="sport-tabs reveal" style={{ marginTop: '32px' }}>
        {FILTER_TABS.map(tab => (
          <button
            key={tab.value}
            className={`sport-tab${activeTab === tab.value ? ' active' : ''}`}
            onClick={() => handleTabChange(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
          No posts in this category yet.
        </div>
      ) : (
        <div className="blog-grid stagger-children" style={{ marginTop: '40px' }}>
          {visible.map(post => {
            const locked = post.access_level === 'members' && !isPaid
            return (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className={`blog-card reveal-scale${locked ? ' blog-card--locked' : ''}`}
              >
                <div className={`blog-card__image${locked ? ' blog-card__image--locked' : ''}`}>
                  <Image
                    src={coverForPost(post.cover_image, post.tag)}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    style={{ objectFit: 'cover' }}
                  />
                  {locked && <span className="blog-card__lock-badge"><IconLock size={12} /> Members</span>}
                </div>
                <div className="blog-card__body">
                  <span className="blog-card__tag">{post.tag}</span>
                  <h3 className="blog-card__title">{post.title}</h3>
                  {post.excerpt && (
                    <p className={`blog-card__excerpt${locked ? ' blog-card__excerpt--locked' : ''}`}>
                      {post.excerpt}
                    </p>
                  )}
                  <div className="blog-card__meta">
                    {post.published_at && <span>{fmtDate(post.published_at)}</span>}
                    <span className={locked ? 'blog-card__upgrade-hint' : ''}>
                      {locked ? 'Upgrade to read →' : 'Read more →'}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="blog-pagination">
          <button
            className="blog-pagination__btn"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            ← Previous
          </button>
          <span className="blog-pagination__info">Page {page} of {totalPages}</span>
          <button
            className="blog-pagination__btn"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </>
  )
}
