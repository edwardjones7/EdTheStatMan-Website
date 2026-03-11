'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import type { SubscriptionTier, SubscriptionStatus, AccessLevel } from '@/lib/supabase/types'
import type { AllSiteContent } from '@/lib/site-content'
import AdminSystemsTab, { type BettingSystem } from './AdminSystemsTab'
import AdminTrendsTab, { type BettingTrend } from './AdminTrendsTab'
import AdminContentTab from './AdminContentTab'

interface User {
  id: string
  email: string
  full_name: string | null
  subscription_tier: SubscriptionTier
  subscription_status: SubscriptionStatus | null
  is_admin: boolean
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

interface Post {
  id: string
  title: string
  slug: string
  tag: string
  access_level: AccessLevel
  published: boolean
  published_at: string | null
  author_id: string
  created_at: string
  updated_at: string
}

interface Props {
  users: User[]
  posts: Post[]
  systems: BettingSystem[]
  trends: BettingTrend[]
  content: AllSiteContent
  initialTab?: string
}

const TIER_CLASS: Record<string, string> = {
  free: 'nav__user-tier--free',
  basic: 'nav__user-tier--basic',
  premium: 'nav__user-tier--premium',
  admin: 'nav__user-tier--admin',
}

const STATUS_COLOR: Record<string, string> = {
  active: 'admin-badge--green',
  trialing: 'admin-badge--blue',
  canceled: 'admin-badge--red',
  past_due: 'admin-badge--yellow',
  incomplete: 'admin-badge--yellow',
}

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export default function AdminDashboard({ users, posts, systems, trends, content, initialTab }: Props) {
  const [tab, setTab] = useState<'users' | 'posts' | 'systems' | 'trends' | 'content'>(
    (['users', 'posts', 'systems', 'trends', 'content'].includes(initialTab ?? '') ? initialTab : 'users') as 'users'
  )
  const [userSearch, setUserSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [postSearch, setPostSearch] = useState('')
  const [postFilter, setPostFilter] = useState<string>('all')

  // ── Stats ──────────────────────────────────────────
  const stats = useMemo(() => {
    const freeUsers    = users.filter(u => u.subscription_tier === 'free').length
    const basicUsers   = users.filter(u => u.subscription_tier === 'basic').length
    const premiumUsers = users.filter(u => u.subscription_tier === 'premium').length
    const activeUsers  = users.filter(u => u.subscription_status === 'active').length
    const pastDue      = users.filter(u => u.subscription_status === 'past_due').length
    const newThisMonth = users.filter(u => isThisMonth(u.created_at)).length
    const adminCount   = users.filter(u => u.is_admin).length
    const publishedPosts  = posts.filter(p => p.published).length
    const draftPosts      = posts.filter(p => !p.published).length
    const freePosts       = posts.filter(p => p.access_level === 'free').length
    const membersPosts    = posts.filter(p => p.access_level === 'members').length
    return {
      totalUsers: users.length, freeUsers, basicUsers, premiumUsers,
      activeUsers, pastDue, newThisMonth, adminCount,
      totalPosts: posts.length, publishedPosts, draftPosts, freePosts, membersPosts,
    }
  }, [users, posts])

  // ── Filtered users ─────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase()
    return users.filter(u => {
      const matchSearch = !q || u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q)
      const matchTier = tierFilter === 'all' || u.subscription_tier === tierFilter || (tierFilter === 'admin' && u.is_admin)
      return matchSearch && matchTier
    })
  }, [users, userSearch, tierFilter])

  // ── Filtered posts ─────────────────────────────────
  const filteredPosts = useMemo(() => {
    const q = postSearch.toLowerCase()
    return posts.filter(p => {
      const matchSearch = !q || p.title.toLowerCase().includes(q) || p.tag.toLowerCase().includes(q)
      const matchFilter =
        postFilter === 'all' ||
        (postFilter === 'published' && p.published) ||
        (postFilter === 'draft' && !p.published) ||
        (postFilter === 'free' && p.access_level === 'free') ||
        (postFilter === 'members' && p.access_level === 'members')
      return matchSearch && matchFilter
    })
  }, [posts, postSearch, postFilter])

  return (
    <main className="admin-page">
      <div className="admin-container">

        {/* ── Header ── */}
        <div className="admin-header">
          <div>
            <h1 className="admin-header__title">Admin Dashboard</h1>
            <p className="admin-header__sub">Full site overview — users, content, and metrics.</p>
          </div>
        </div>

        {/* ── KPI Row ── */}
        <div className="admin-kpi-row">
          <div className="admin-kpi-card">
            <div className="admin-kpi-card__top">
              <span className="admin-kpi-card__label">Total Users</span>
              {stats.newThisMonth > 0 && (
                <span className="admin-kpi-card__badge admin-kpi-card__badge--green">+{stats.newThisMonth} this month</span>
              )}
            </div>
            <div className="admin-kpi-card__value">{stats.totalUsers}</div>
            <div className="admin-kpi-card__sub">{stats.freeUsers} free · {stats.basicUsers + stats.premiumUsers} paid</div>
            <div className="admin-kpi-card__bar">
              <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--cyan" style={{ width: `${stats.totalUsers ? ((stats.basicUsers + stats.premiumUsers) / stats.totalUsers) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="admin-kpi-card">
            <div className="admin-kpi-card__top">
              <span className="admin-kpi-card__label">Paid Members</span>
              <span className="admin-kpi-card__badge admin-kpi-card__badge--green">Active</span>
            </div>
            <div className="admin-kpi-card__value">{stats.basicUsers + stats.premiumUsers}</div>
            <div className="admin-kpi-card__sub">{stats.basicUsers} basic · {stats.premiumUsers} premium</div>
            <div className="admin-kpi-card__bar">
              <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--green" style={{ width: `${stats.totalUsers ? ((stats.basicUsers + stats.premiumUsers) / stats.totalUsers) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="admin-kpi-card">
            <div className="admin-kpi-card__top">
              <span className="admin-kpi-card__label">Subscription Health</span>
              {stats.pastDue > 0
                ? <span className="admin-kpi-card__badge admin-kpi-card__badge--red">{stats.pastDue} past due</span>
                : <span className="admin-kpi-card__badge admin-kpi-card__badge--green">Healthy</span>}
            </div>
            <div className="admin-kpi-card__value">{stats.activeUsers}</div>
            <div className="admin-kpi-card__sub">active subscriptions</div>
            <div className="admin-kpi-card__bar">
              <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--purple" style={{ width: `${(stats.basicUsers + stats.premiumUsers) ? (stats.activeUsers / (stats.basicUsers + stats.premiumUsers)) * 100 : 0}%` }} />
            </div>
          </div>

          <div className="admin-kpi-card">
            <div className="admin-kpi-card__top">
              <span className="admin-kpi-card__label">Published Content</span>
              {stats.draftPosts > 0 && (
                <span className="admin-kpi-card__badge admin-kpi-card__badge--muted">{stats.draftPosts} drafts</span>
              )}
            </div>
            <div className="admin-kpi-card__value">{stats.publishedPosts}</div>
            <div className="admin-kpi-card__sub">{stats.freePosts} free · {stats.membersPosts} members-only</div>
            <div className="admin-kpi-card__bar">
              <div className="admin-kpi-card__bar-fill admin-kpi-card__bar-fill--gold" style={{ width: `${stats.totalPosts ? (stats.publishedPosts / stats.totalPosts) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        {/* ── Breakdown Panels ── */}
        <div className="admin-breakdown-row">
          <div className="admin-breakdown-card">
            <h3 className="admin-breakdown-card__title">User Distribution</h3>
            <div className="admin-breakdown-list">
              <BreakdownRow label="Free" value={stats.freeUsers} total={stats.totalUsers} color="var(--text-muted)" />
              <BreakdownRow label="Basic" value={stats.basicUsers} total={stats.totalUsers} color="var(--accent-green)" />
              <BreakdownRow label="Premium" value={stats.premiumUsers} total={stats.totalUsers} color="var(--accent-purple)" />
              <BreakdownRow label="Admins" value={stats.adminCount} total={stats.totalUsers} color="var(--accent-gold)" />
            </div>
            <div className="admin-breakdown-footer">
              <span>{stats.newThisMonth} new users this month</span>
            </div>
          </div>

          <div className="admin-breakdown-card">
            <h3 className="admin-breakdown-card__title">Content Overview</h3>
            <div className="admin-breakdown-list">
              <BreakdownRow label="Published" value={stats.publishedPosts} total={stats.totalPosts} color="var(--accent-green)" />
              <BreakdownRow label="Drafts" value={stats.draftPosts} total={stats.totalPosts} color="var(--text-muted)" />
              <BreakdownRow label="Free Access" value={stats.freePosts} total={stats.totalPosts} color="var(--accent-cyan)" />
              <BreakdownRow label="Members Only" value={stats.membersPosts} total={stats.totalPosts} color="var(--accent-purple)" />
            </div>
            <div className="admin-breakdown-footer">
              <span>{stats.totalPosts} total posts</span>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'users' ? 'admin-tab--active' : ''}`} onClick={() => setTab('users')}>
            Users <span className="admin-tab__count">{users.length}</span>
          </button>
          <button className={`admin-tab ${tab === 'posts' ? 'admin-tab--active' : ''}`} onClick={() => setTab('posts')}>
            Posts <span className="admin-tab__count">{posts.length}</span>
          </button>
          <button className={`admin-tab ${tab === 'systems' ? 'admin-tab--active' : ''}`} onClick={() => setTab('systems')}>
            Systems <span className="admin-tab__count">{systems.length}</span>
          </button>
          <button className={`admin-tab ${tab === 'trends' ? 'admin-tab--active' : ''}`} onClick={() => setTab('trends')}>
            Trends <span className="admin-tab__count">{trends.length}</span>
          </button>
          <button className={`admin-tab ${tab === 'content' ? 'admin-tab--active' : ''}`} onClick={() => setTab('content')}>
            Page Content
          </button>
        </div>

        {/* ── Users Table ── */}
        {tab === 'users' && (
          <div className="admin-section">
            <div className="admin-section__toolbar">
              <input
                className="admin-search"
                type="search"
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
              <div className="admin-filters">
                {['all', 'free', 'basic', 'premium', 'admin'].map(f => (
                  <button
                    key={f}
                    className={`admin-filter-btn ${tierFilter === f ? 'admin-filter-btn--active' : ''}`}
                    onClick={() => setTierFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <p className="admin-count">Showing {filteredUsers.length} of {users.length} users</p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Stripe</th>
                    <th>Admin</th>
                    <th>Joined</th>
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={7} className="admin-table__empty">No users found.</td></tr>
                  ) : filteredUsers.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-avatar">
                            {(user.full_name ?? user.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="admin-user-name">{user.full_name ?? <span className="admin-muted">—</span>}</div>
                            <div className="admin-user-email">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`nav__user-tier ${TIER_CLASS[user.is_admin ? 'admin' : user.subscription_tier]}`}>
                          {user.is_admin ? 'Admin' : user.subscription_tier.charAt(0).toUpperCase() + user.subscription_tier.slice(1)}
                        </span>
                      </td>
                      <td>
                        {user.subscription_status ? (
                          <span className={`admin-badge ${STATUS_COLOR[user.subscription_status] ?? ''}`}>
                            {user.subscription_status.replace('_', ' ')}
                          </span>
                        ) : (
                          <span className="admin-muted">—</span>
                        )}
                      </td>
                      <td>
                        {user.stripe_customer_id ? (
                          <span className="admin-badge admin-badge--green">Connected</span>
                        ) : (
                          <span className="admin-muted">—</span>
                        )}
                      </td>
                      <td>
                        {user.is_admin
                          ? <span className="admin-badge admin-badge--gold">Yes</span>
                          : <span className="admin-muted">No</span>}
                      </td>
                      <td className="admin-muted">{fmt(user.created_at)}</td>
                      <td className="admin-muted">{fmt(user.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Posts Table ── */}
        {tab === 'posts' && (
          <div className="admin-section">
            <div className="admin-section__toolbar">
              <input
                className="admin-search"
                type="search"
                placeholder="Search by title or tag…"
                value={postSearch}
                onChange={e => setPostSearch(e.target.value)}
              />
              <div className="admin-filters">
                {['all', 'published', 'draft', 'free', 'members'].map(f => (
                  <button
                    key={f}
                    className={`admin-filter-btn ${postFilter === f ? 'admin-filter-btn--active' : ''}`}
                    onClick={() => setPostFilter(f)}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <Link href="/admin/posts/new" className="btn btn--primary btn--sm">
                + New Post
              </Link>
            </div>
            <p className="admin-count">Showing {filteredPosts.length} of {posts.length} posts</p>
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
                  {filteredPosts.length === 0 ? (
                    <tr><td colSpan={7} className="admin-table__empty">No posts found.</td></tr>
                  ) : filteredPosts.map(post => (
                    <tr key={post.id}>
                      <td>
                        <div className="admin-post-title">{post.title}</div>
                        <div className="admin-user-email">/blog/{post.slug}</div>
                      </td>
                      <td><span className="admin-tag">{post.tag}</span></td>
                      <td>
                        <span className={`admin-badge ${post.access_level === 'members' ? 'admin-badge--purple' : 'admin-badge--muted'}`}>
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
              <div className="admin-empty-state">
                <p>No blog posts yet.</p>
                <Link href="/admin/posts/new" className="btn btn--primary btn--sm">Create your first post</Link>
              </div>
            )}
          </div>
        )}

        {/* ── Systems Tab ── */}
        {tab === 'systems' && <AdminSystemsTab systems={systems} />}

        {/* ── Trends Tab ── */}
        {tab === 'trends' && <AdminTrendsTab trends={trends} />}

        {/* ── Content Tab ── */}
        {tab === 'content' && <AdminContentTab content={content} />}

      </div>
    </main>
  )
}

function BreakdownRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="admin-breakdown-row">
      <div className="admin-breakdown-row__left">
        <span className="admin-breakdown-row__dot" style={{ background: color }} />
        <span className="admin-breakdown-row__label">{label}</span>
      </div>
      <div className="admin-breakdown-row__right">
        <div className="admin-breakdown-row__bar-track">
          <div className="admin-breakdown-row__bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="admin-breakdown-row__value">{value}</span>
        <span className="admin-breakdown-row__pct">{pct}%</span>
      </div>
    </div>
  )
}
