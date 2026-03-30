'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import type { SubscriptionTier, SubscriptionStatus, AccessLevel } from '@/lib/supabase/types'

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
  last_seen_at: string | null
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

interface AnalyticsData {
  totalViews:   number
  viewsInRange: number
  viewsToday:   number
  points:       { label: string; count: number }[]
  topPages:     { path: string; count: number }[]
  referrers:    { source: string; count: number }[]
  devices:      { device: string; count: number }[]
  countries:    { country: string; count: number }[]
  newSignups:   number
  totalUsers:   number
  paidUsers:    number
}

type Range = 'week' | 'month' | 'year'

interface Props {
  users: User[]
  posts: Post[]
  initialTab?: string
}

const RANGE_LABELS: Record<Range, string> = { week: 'This Week', month: 'This Month', year: 'This Year' }
const CHART_TITLES: Record<Range, string> = {
  week:  'Page Views — 7 Days',
  month: 'Page Views — Last 30 Days',
  year:  'Page Views — Last 12 Months',
}

const DAY = 24 * 60 * 60 * 1000

function toDateStr(ms: number): string {
  return new Date(ms).toISOString().split('T')[0]
}

function defaultWeekStart(): string {
  return toDateStr(Date.now() - 6 * DAY)
}

function weekEndStr(start: string): string {
  return toDateStr(new Date(start).getTime() + 6 * DAY)
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return fmt(dateStr)
}

function isThisMonth(dateStr: string) {
  const d = new Date(dateStr), now = new Date()
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

export default function AdminDashboard({ users, posts, initialTab }: Props) {
  const [tab, setTab]     = useState<'users' | 'posts'>(
    (['users', 'posts'].includes(initialTab ?? '') ? initialTab : 'users') as 'users'
  )
  const [range, setRange]         = useState<Range>('month')
  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [analytics, setAnalytics]     = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setALoading] = useState(true)
  const [userSearch, setUserSearch]   = useState('')
  const [tierFilter, setTierFilter]   = useState<string>('all')
  const [postSearch, setPostSearch]   = useState('')
  const [postFilter, setPostFilter]   = useState<string>('all')

  useEffect(() => { setWeekStart(defaultWeekStart()) }, [range])

  useEffect(() => {
    setALoading(true)
    const params = new URLSearchParams({ range })
    if (range === 'week') params.set('weekStart', weekStart)
    fetch(`/api/admin/analytics?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { setAnalytics(d); setALoading(false) })
      .catch(() => setALoading(false))
  }, [range, weekStart])

  const stats = useMemo(() => {
    const freeUsers    = users.filter(u => u.subscription_tier === 'free').length
    const basicUsers   = users.filter(u => u.subscription_tier === 'basic').length
    const premiumUsers = users.filter(u => u.subscription_tier === 'premium').length
    const activeUsers  = users.filter(u => u.subscription_status === 'active').length
    const pastDue      = users.filter(u => u.subscription_status === 'past_due').length
    const newThisMonth = users.filter(u => isThisMonth(u.created_at)).length
    const adminCount   = users.filter(u => u.is_admin).length
    const publishedPosts = posts.filter(p => p.published).length
    const draftPosts     = posts.filter(p => !p.published).length
    const freePosts      = posts.filter(p => p.access_level === 'free').length
    const membersPosts   = posts.filter(p => p.access_level === 'members').length
    return {
      totalUsers: users.length, freeUsers, basicUsers, premiumUsers,
      activeUsers, pastDue, newThisMonth, adminCount,
      totalPosts: posts.length, publishedPosts, draftPosts, freePosts, membersPosts,
    }
  }, [users, posts])

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase()
    return users.filter(u => {
      const matchSearch = !q || u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q)
      const matchTier   = tierFilter === 'all' || u.subscription_tier === tierFilter || (tierFilter === 'admin' && u.is_admin)
      return matchSearch && matchTier
    })
  }, [users, userSearch, tierFilter])

  const filteredPosts = useMemo(() => {
    const q = postSearch.toLowerCase()
    return posts.filter(p => {
      const matchSearch = !q || p.title.toLowerCase().includes(q) || p.tag.toLowerCase().includes(q)
      const matchFilter =
        postFilter === 'all' ||
        (postFilter === 'published' && p.published) ||
        (postFilter === 'draft'     && !p.published) ||
        (postFilter === 'free'      && p.access_level === 'free') ||
        (postFilter === 'members'   && p.access_level === 'members')
      return matchSearch && matchFilter
    })
  }, [posts, postSearch, postFilter])

  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  const maxBar = analytics ? Math.max(...analytics.points.map(p => p.count), 1) : 1
  const totalRangeViews = analytics?.points.reduce((s, p) => s + p.count, 0) ?? 0
  const convPct = analytics?.totalUsers ? ((analytics.paidUsers / analytics.totalUsers) * 100).toFixed(1) : null

  return (
    <main className="admin-page">
      <div className="admin-container">

        {/* ── Header + range toggle ── */}
        <div className="admin-header">
          <div>
            <h1 className="admin-header__title">Admin Dashboard</h1>
            <p className="admin-header__sub">Site overview — users, content &amp; traffic.</p>
          </div>
          <div className="admin-filters" style={{ margin: 0 }}>
            {(['week', 'month', 'year'] as Range[]).map(r => (
              <button
                key={r}
                className={`admin-filter-btn ${range === r ? 'admin-filter-btn--active' : ''}`}
                onClick={() => setRange(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* ── Combined KPI strip (6 cards) ── */}
        <div className="admin-kpi-strip" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
          <KpiCard
            label="Total Users"
            value={stats.totalUsers}
            sub={`${stats.freeUsers} free · ${stats.basicUsers + stats.premiumUsers} paid`}
            color="cyan"
            badge={stats.newThisMonth > 0 ? `+${stats.newThisMonth} this mo` : undefined}
            badgeColor="green"
          />
          <KpiCard
            label="Paid Members"
            value={stats.basicUsers + stats.premiumUsers}
            sub={`${stats.basicUsers} basic · ${stats.premiumUsers} premium`}
            color="green"
          />
          <KpiCard
            label="Conversion"
            value={convPct ? `${convPct}%` : '—'}
            sub={analytics ? `${analytics.paidUsers} of ${analytics.totalUsers} users` : 'loading…'}
            color="purple"
          />
          <KpiCard
            label="Total Views"
            value={analyticsLoading ? '—' : (analytics?.totalViews ?? 0).toLocaleString()}
            sub="all time"
            color="cyan"
          />
          <KpiCard
            label={RANGE_LABELS[range]}
            value={analyticsLoading ? '—' : (analytics?.viewsInRange ?? 0).toLocaleString()}
            sub="page views"
            color="green"
            badge={analytics?.viewsToday ? `${analytics.viewsToday} today` : undefined}
            badgeColor="green"
          />
          <KpiCard
            label="New Signups"
            value={analyticsLoading ? '—' : (analytics?.newSignups ?? 0).toLocaleString()}
            sub={RANGE_LABELS[range].toLowerCase()}
            color="gold"
          />
        </div>

        {/* ── Chart + breakdowns side by side ── */}
        <div className="admin-chart-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', alignItems: 'start' }}>

          {/* Left: Chart, then Top Pages + Traffic Sources below it */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="admin-breakdown-card">
              <h3 className="admin-breakdown-card__title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span>
                  {CHART_TITLES[range]}
                  {range === 'week' && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.82rem', marginLeft: '0.5rem' }}>
                      {fmtDate(weekStart)} – {fmtDate(weekEndStr(weekStart))}
                      {!analyticsLoading && analytics && <> · {totalRangeViews.toLocaleString()} views</>}
                    </span>
                  )}
                  {range !== 'week' && !analyticsLoading && analytics && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.82rem', marginLeft: '0.6rem' }}>
                      {totalRangeViews.toLocaleString()} total
                    </span>
                  )}
                </span>
                {range === 'week' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 400 }}>
                    <button
                      onClick={() => setWeekStart(s => toDateStr(new Date(s).getTime() - 7 * DAY))}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px 8px', fontSize: '0.85rem', lineHeight: 1.6 }}
                    >←</button>
                    <input
                      type="date"
                      value={weekStart}
                      max={defaultWeekStart()}
                      onChange={e => e.target.value && setWeekStart(e.target.value)}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '2px 6px', cursor: 'pointer', colorScheme: 'dark' }}
                    />
                    <button
                      onClick={() => setWeekStart(s => toDateStr(Math.min(new Date(s).getTime() + 7 * DAY, new Date(defaultWeekStart()).getTime())))}
                      disabled={weekStart >= defaultWeekStart()}
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', cursor: weekStart >= defaultWeekStart() ? 'default' : 'pointer', padding: '2px 8px', fontSize: '0.85rem', lineHeight: 1.6, opacity: weekStart >= defaultWeekStart() ? 0.35 : 1 }}
                    >→</button>
                  </span>
                )}
              </h3>
              {analyticsLoading ? (
                <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="admin-muted" style={{ fontSize: '0.85rem' }}>Loading…</span>
                </div>
              ) : analytics && analytics.points.length > 0 ? (
                <div className="analytics-chart-wrap">
                  <div className={`analytics-chart${analytics.points.length > 15 ? ' analytics-chart--dense' : ''}`}>
                    {analytics.points.map((p, i) => {
                      const heightPct = (p.count / maxBar) * 100
                      const n = analytics.points.length
                      const showLabel = i === 0 || i === Math.floor(n / 2) || i === n - 1
                      return (
                        <div
                          key={i}
                          className="analytics-chart__col"
                          onMouseEnter={() => setHoveredBar(i)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          {hoveredBar === i && (
                            <div className="analytics-bar-tooltip">
                              {p.count} view{p.count !== 1 ? 's' : ''}
                            </div>
                          )}
                          <div className="analytics-chart__bar" style={{ height: `${Math.max(heightPct, p.count > 0 ? 3 : 0)}%` }} />
                          <div className={`analytics-chart__label ${showLabel ? 'analytics-chart__label--show' : ''}`}>{p.label}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="admin-muted" style={{ fontSize: '0.85rem' }}>No data yet.</span>
                </div>
              )}
            </div>

            {analytics && (
              <>
                <div className="admin-breakdown-card">
                  <h3 className="admin-breakdown-card__title">Top Pages — {RANGE_LABELS[range]}</h3>
                  {analytics.topPages.length > 0 ? (
                    <div className="admin-breakdown-list">
                      {analytics.topPages.slice(0, 7).map(p => (
                        <BreakdownRow key={p.path} label={p.path} value={p.count} total={totalRangeViews} color="var(--accent-cyan)" mono />
                      ))}
                    </div>
                  ) : (
                    <p className="admin-muted" style={{ padding: '1rem 0', fontSize: '0.82rem' }}>No data yet.</p>
                  )}
                </div>

                <div className="admin-breakdown-card">
                  <h3 className="admin-breakdown-card__title">Traffic Sources — {RANGE_LABELS[range]}</h3>
                  {analytics.referrers.length > 0 ? (
                    <div className="admin-breakdown-list">
                      {analytics.referrers.map(r => (
                        <BreakdownRow key={r.source} label={r.source} value={r.count} total={totalRangeViews} color="var(--accent-green)" mono />
                      ))}
                    </div>
                  ) : (
                    <p className="admin-muted" style={{ padding: '1rem 0', fontSize: '0.82rem' }}>No referrer data yet.</p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Right: Users, Content, Devices, Countries stacked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="admin-breakdown-card">
              <h3 className="admin-breakdown-card__title">Users</h3>
              <div className="admin-breakdown-list">
                <BreakdownRow label="Free"    value={stats.freeUsers}    total={stats.totalUsers} color="var(--text-muted)" />
                <BreakdownRow label="Basic"   value={stats.basicUsers}   total={stats.totalUsers} color="var(--accent-green)" />
                <BreakdownRow label="Premium" value={stats.premiumUsers} total={stats.totalUsers} color="var(--accent-purple)" />
                <BreakdownRow label="Admins"  value={stats.adminCount}   total={stats.totalUsers} color="var(--accent-gold)" />
              </div>
              <div className="admin-breakdown-footer"><span>{stats.newThisMonth} new this month</span></div>
            </div>

            <div className="admin-breakdown-card">
              <h3 className="admin-breakdown-card__title">Content</h3>
              <div className="admin-breakdown-list">
                <BreakdownRow label="Published"    value={stats.publishedPosts} total={stats.totalPosts} color="var(--accent-green)" />
                <BreakdownRow label="Drafts"       value={stats.draftPosts}     total={stats.totalPosts} color="var(--text-muted)" />
                <BreakdownRow label="Free Access"  value={stats.freePosts}      total={stats.totalPosts} color="var(--accent-cyan)" />
                <BreakdownRow label="Members Only" value={stats.membersPosts}   total={stats.totalPosts} color="var(--accent-purple)" />
              </div>
              <div className="admin-breakdown-footer"><span>{stats.totalPosts} total posts</span></div>
            </div>

            {analytics && (
              <>
                <div className="admin-breakdown-card">
                  <h3 className="admin-breakdown-card__title">Devices</h3>
                  <div className="admin-breakdown-list">
                    {analytics.devices.map(d => (
                      <BreakdownRow
                        key={d.device}
                        label={d.device.charAt(0).toUpperCase() + d.device.slice(1)}
                        value={d.count}
                        total={totalRangeViews}
                        color={d.device === 'mobile' ? 'var(--accent-cyan)' : d.device === 'tablet' ? 'var(--accent-gold)' : 'var(--accent-purple)'}
                      />
                    ))}
                  </div>
                </div>

                {analytics.countries.length > 0 && (
                  <div className="admin-breakdown-card">
                    <h3 className="admin-breakdown-card__title">Countries</h3>
                    <div className="admin-breakdown-list">
                      {analytics.countries.slice(0, 5).map(c => (
                        <BreakdownRow key={c.country} label={c.country} value={c.count} total={totalRangeViews} color="var(--accent-gold)" />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
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
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={7} className="admin-table__empty">No users found.</td></tr>
                  ) : filteredUsers.map(user => (
                    <tr key={user.id}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-avatar">{(user.full_name ?? user.email).charAt(0).toUpperCase()}</div>
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
                        ) : <span className="admin-muted">—</span>}
                      </td>
                      <td>
                        {user.stripe_customer_id
                          ? <span className="admin-badge admin-badge--green">Connected</span>
                          : <span className="admin-muted">—</span>}
                      </td>
                      <td>
                        {user.is_admin
                          ? <span className="admin-badge admin-badge--gold">Yes</span>
                          : <span className="admin-muted">No</span>}
                      </td>
                      <td className="admin-muted">{fmt(user.created_at)}</td>
                      <td className="admin-muted">{timeAgo(user.last_seen_at)}</td>
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
              <Link href="/admin/posts/new" className="btn btn--primary btn--sm">+ New Post</Link>
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

      </div>
    </main>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, badge, badgeColor,
}: {
  label: string
  value: string | number
  sub: string
  color: 'cyan' | 'green' | 'purple' | 'gold'
  badge?: string
  badgeColor?: 'green' | 'muted'
}) {
  return (
    <div className="admin-kpi-card">
      <div className="admin-kpi-card__top">
        <span className="admin-kpi-card__label">{label}</span>
        {badge && <span className={`admin-kpi-card__badge admin-kpi-card__badge--${badgeColor ?? 'green'}`}>{badge}</span>}
      </div>
      <div className="admin-kpi-card__value">{value}</div>
      <div className="admin-kpi-card__sub">{sub}</div>
      <div className="admin-kpi-card__bar">
        <div className={`admin-kpi-card__bar-fill admin-kpi-card__bar-fill--${color}`} style={{ width: '100%' }} />
      </div>
    </div>
  )
}

function BreakdownRow({ label, value, total, color, mono }: { label: string; value: number; total: number; color: string; mono?: boolean }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="admin-breakdown-row">
      <div className="admin-breakdown-row__left">
        <span className="admin-breakdown-row__dot" style={{ background: color }} />
        <span className="admin-breakdown-row__label" style={mono ? { fontFamily: 'var(--font-mono)', fontSize: '0.78rem' } : undefined}>{label}</span>
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
