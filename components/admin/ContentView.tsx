'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { normalizeTier } from '@/lib/access'
import type { ProofData } from '@/lib/proof'
import AdminPickDraftsTab from '@/components/AdminPickDraftsTab'
import type { AdminPost } from './types'
import { Empty, fmtShort, Kpi, Notice } from './ui'

const POST_FILTERS = ['all', 'published', 'draft', 'free', 'members'] as const
type PostFilter = (typeof POST_FILTERS)[number]

function matches(p: AdminPost, f: PostFilter): boolean {
  if (f === 'published') return p.published
  if (f === 'draft') return !p.published
  if (f === 'free') return normalizeTier(p.access_level) === 'retail'
  if (f === 'members') return normalizeTier(p.access_level) !== 'retail'
  return true
}

function RecordCard({ label, stat }: { label: string; stat: ProofData['books']['members'] }) {
  return stat
    ? <Kpi label={label} value={stat.record} sub={`${stat.pct.toFixed(1)}% · ${stat.units} units · ${stat.graded} graded`} />
    : <Kpi label={label} value="—" sub="Nothing graded yet" />
}

export default function ContentView({ posts, records, pendingPicks, startOn }: {
  posts: AdminPost[] | null
  records: ProofData['books'] | null
  pendingPicks: number | null
  startOn: 'picks' | 'posts'
}) {
  const [section, setSection] = useState(startOn)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PostFilter>('all')

  const rows = useMemo(() => {
    const q = search.toLowerCase()
    return (posts ?? []).filter(p =>
      matches(p, filter) && (!q || p.title.toLowerCase().includes(q) || p.tag.toLowerCase().includes(q)))
  }, [posts, search, filter])

  return (
    <>
      {records ? (
        <div className="adm-grid-2">
          <RecordCard label="Members record" stat={records.members} />
          <RecordCard label="Free record" stat={records.free} />
        </div>
      ) : <Notice>Couldn&rsquo;t load the pick records.</Notice>}

      <div className="admin-filters" role="group" aria-label="Content section">
        <button
          type="button"
          className={`admin-filter-btn ${section === 'picks' ? 'admin-filter-btn--active' : ''}`}
          aria-pressed={section === 'picks'}
          onClick={() => setSection('picks')}
        >
          Pick Queue {!!pendingPicks && <span className="adm-count">{pendingPicks}</span>}
        </button>
        <button
          type="button"
          className={`admin-filter-btn ${section === 'posts' ? 'admin-filter-btn--active' : ''}`}
          aria-pressed={section === 'posts'}
          onClick={() => setSection('posts')}
        >
          Posts {posts && <span className="adm-count">{posts.length}</span>}
        </button>
      </div>

      {section === 'picks' && <AdminPickDraftsTab />}

      {section === 'posts' && (posts === null ? <Notice>Couldn&rsquo;t load posts.</Notice> : (
        <div className="admin-section">
          <div className="admin-section__toolbar">
            <input
              className="admin-search"
              type="search"
              placeholder="Search by title or tag…"
              aria-label="Search posts"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="admin-filters">
              {POST_FILTERS.map(f => (
                <button
                  key={f}
                  type="button"
                  className={`admin-filter-btn ${filter === f ? 'admin-filter-btn--active' : ''}`}
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <Link href="/admin/posts/new" className="btn btn--primary btn--sm">+ New Post</Link>
          </div>
          <p className="admin-count">Showing {rows.length} of {posts.length} posts</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Tag</th>
                  <th>Access</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={7} className="admin-table__empty">No posts found.</td></tr>
                ) : rows.map(post => (
                  <tr key={post.id}>
                    <td>
                      <div className="admin-post-title">{post.title}</div>
                      <div className="admin-user-email">/blog/{post.slug}</div>
                    </td>
                    <td><span className="admin-tag">{post.tag}</span></td>
                    <td>
                      <span className={`admin-badge ${normalizeTier(post.access_level) !== 'retail' ? 'admin-badge--purple' : 'admin-badge--muted'}`}>
                        {post.access_level}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${post.published ? 'admin-badge--green' : 'admin-badge--muted'}`}>
                        {post.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="admin-muted">{post.published_at ? fmtShort(post.published_at) : '—'}</td>
                    <td className="admin-muted">{fmtShort(post.created_at)}</td>
                    <td>
                      <div className="admin-actions">
                        <Link href={`/admin/posts/${post.id}/edit`} className="admin-action-btn">Edit</Link>
                        <Link href={`/blog/${post.slug}`} className="admin-action-btn" target="_blank">View</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {posts.length === 0 && (
            <Empty>No blog posts yet.</Empty>
          )}
        </div>
      ))}
    </>
  )
}
