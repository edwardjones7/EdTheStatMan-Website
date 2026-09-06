'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SubscriptionTier, SubscriptionStatus, AccessLevel } from '@/lib/supabase/types'
import { normalizeTier, TIERS, TIER_SHORT_LABEL, type Tier } from '@/lib/access'

/** The four sellable rungs, in ladder order. */
const PAID_TIERS: Tier[] = TIERS.filter(t => t !== 'retail')

// Teal climbs into gold as the rung gets more expensive, the same reading the
// rest of the site gives those two colours.
const TIER_ROW_COLOR: Record<Tier, string> = {
  retail: 'var(--text-muted)',
  portfolio: 'var(--accent-teal)',
  desk: 'var(--accent-teal)',
  private: 'var(--accent-gold)',
  institutional: 'var(--accent-gold)',
}

/**
 * What this member can actually open right now.
 *
 * The same rule resolveAccess() applies on every page render, repeated here
 * because the dashboard reads profiles directly. It is not a formality: a paid
 * tier with a past expiry is `retail` to the whole site, but the stored column
 * still says what they last paid for, so the dashboard was calling two members
 * who lapsed in May and August paying customers, and counting them in Paid
 * Members. Nothing recomputes that column when a pass simply runs out -- expiry
 * fires no webhook -- so it can only be resolved at read time.
 */
function liveTier(u: User): Tier {
  // Deliberately NOT special-cased for admins, even though resolveAccess()
  // hands them institutional on the site. Admin is an overlay on this screen,
  // not a rung: it has its own row, and the two are counted separately so the
  // breakdown still sums to the total. Returning 'institutional' here put both
  // admins into the Institutional row AND the Admins row, and inflated Paid
  // Members by two people who have never paid.
  const stored = normalizeTier(u.subscription_tier)
  if (stored === 'retail') return 'retail'
  const exp = u.access_expires_at ? new Date(u.access_expires_at).getTime() : 0
  return exp > Date.now() ? stored : 'retail'
}

/** Paid at some point, but not today. The number worth seeing on its own. */
function hasLapsed(u: User): boolean {
  return !u.is_admin && normalizeTier(u.subscription_tier) !== 'retail' && liveTier(u) === 'retail'
}

/** Where a live entitlement comes from, for the Access column. */
function accessSource(u: User): string | null {
  const live = (t: string | null, when: string | null) =>
    !!t && !!when && new Date(when).getTime() > Date.now()
  const pass = live(u.pass_tier, u.pass_expires_at)
  const sub = live(u.sub_tier, u.sub_current_period_end)
  if (pass && sub) return 'pass + sub'
  if (pass) return 'pass'
  if (sub) return 'subscription'
  return null
}

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
  // Entitlement. subscription_tier is DERIVED and goes stale the moment a pass
  // runs out, because nothing recomputes it on a clock -- expiry fires no
  // webhook. access_expires_at is the only field that says whether the tier
  // above is still true today.
  access_expires_at: string | null
  pass_tier: SubscriptionTier | null
  pass_expires_at: string | null
  sub_tier: SubscriptionTier | null
  sub_current_period_end: string | null
  billing_mode: string | null
  discord_user_id: string | null
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
  points:       { label: string; count: number; visitors: number }[]
  topPages:     { path: string; count: number }[]
  referrers:    { source: string; count: number }[]
  devices:      { device: string; count: number }[]
  countries:    { country: string; count: number }[]
  utmSources:   { source: string; count: number }[]
  uniqueVisitors: number
  sessions:       number
  bounceRate:     number
  avgSessionSecs: number
  revenueInRange: number
  revenueTotal:   number
  purchaseCount:  number
  revenueByTier:  Record<string, number>
  funnel: { winVisitors: number; checkoutClicks: number; purchases: number }
  newSignups:   number
  totalUsers:   number
  paidUsers:    number
}

interface LiveData {
  activeNow:    number
  viewsToday:   number
  revenueToday: number
}

type Range = 'week' | 'month' | 'year'

interface Props {
  users: User[]
  posts: Post[]
  initialTab?: string
  /** Prefetched on the server for the default ('month') range. */
  initialAnalytics: AnalyticsData
}

/** All-time figures, identical for every range — fetched once, then reused. */
type GlobalTotals = Pick<AnalyticsData, 'totalViews' | 'revenueTotal' | 'totalUsers' | 'paidUsers'>

// Cached range payloads older than this are still shown instantly, then
// refreshed in the background.
const CACHE_TTL_MS = 60_000

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

function fmtMoney(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function fmtDuration(secs: number): string {
  const s = Math.round(secs)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// Keyed on LADDER values, so every lookup goes through normalizeTier() first --
// the column still holds legacy strings until the migration runs and ladder
// ones after, and this component has to render both.
const TIER_CLASS: Record<string, string> = {
  ...Object.fromEntries(TIERS.map(t => [t, `nav__user-tier--${t}`])),
  admin: 'nav__user-tier--admin',
}

// 'all' and 'admin' are not rungs; between them is the ladder, in order. These
// are compared against normalizeTier() output, so they must be ladder values --
// the pre-v3 names here matched nothing, because normalizeTier('basic') is
// 'desk' and never equalled the 'basic' the button sent.
const TIER_FILTERS = ['all', ...TIERS, 'lapsed', 'admin']

function filterLabel(f: string): string {
  if (f === 'all') return 'All'
  if (f === 'admin') return 'Admin'
  if (f === 'lapsed') return 'Lapsed'
  return TIER_SHORT_LABEL[f as (typeof TIERS)[number]]
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

export default function AdminDashboard({ users, posts, initialTab, initialAnalytics }: Props) {
  const router = useRouter()
  const [tab, setTab]     = useState<'users' | 'posts'>(
    (['users', 'posts'].includes(initialTab ?? '') ? initialTab : 'users') as 'users'
  )
  const [range, setRange]         = useState<Range>('month')
  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [analytics, setAnalytics]     = useState<AnalyticsData | null>(initialAnalytics)
  const [analyticsLoading, setALoading] = useState(false)
  const [refreshing, setRefreshing]   = useState(false)
  const [live, setLive] = useState<LiveData | null>(null)
  const [userSearch, setUserSearch]   = useState('')
  const [tierFilter, setTierFilter]   = useState<string>('all')
  const [postSearch, setPostSearch]   = useState('')
  const [postFilter, setPostFilter]   = useState<string>('all')

  useEffect(() => { setWeekStart(defaultWeekStart()) }, [range])

  // Per-range cache, seeded with the server-rendered 'month' payload. Switching
  // to a range that's already been loaded is instant; a stale entry is shown
  // straight away and refreshed behind it.
  const cacheRef = useRef<Map<string, { data: AnalyticsData; ts: number }>>(
    new Map([['month', { data: initialAnalytics, ts: Date.now() }]])
  )
  const totalsRef = useRef<GlobalTotals>({
    totalViews:   initialAnalytics.totalViews,
    revenueTotal: initialAnalytics.revenueTotal,
    totalUsers:   initialAnalytics.totalUsers,
    paidUsers:    initialAnalytics.paidUsers,
  })
  // Guards against an earlier, slower response overwriting a later selection.
  const activeKeyRef = useRef('month')

  useEffect(() => {
    const key = range === 'week' ? `week:${weekStart}` : range
    activeKeyRef.current = key

    const cached = cacheRef.current.get(key)
    if (cached) {
      setAnalytics(cached.data)
      setALoading(false)
      if (Date.now() - cached.ts < CACHE_TTL_MS) return // fresh enough, no request
    } else {
      setALoading(true)
    }
    setRefreshing(true)

    const params = new URLSearchParams({ range, totals: '0' }) // all-time figures already held
    if (range === 'week') params.set('weekStart', weekStart)

    let cancelled = false
    fetch(`/api/admin/analytics?${params}`, { cache: 'no-store' })
      .then(r => r.json())
      .then((d: AnalyticsData) => {
        if (cancelled) return
        const merged = { ...d, ...totalsRef.current }
        cacheRef.current.set(key, { data: merged, ts: Date.now() })
        if (activeKeyRef.current === key) {
          setAnalytics(merged)
          setALoading(false)
          setRefreshing(false)
        }
      })
      .catch(() => { if (!cancelled) { setALoading(false); setRefreshing(false) } })

    return () => { cancelled = true }
    // initialAnalytics only seeds the refs above, which ignore later values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, weekStart])

  // Live stats — poll every 30s so the dashboard stays current without reloads
  useEffect(() => {
    let cancelled = false
    const load = () =>
      fetch('/api/admin/analytics/live', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { if (!cancelled && typeof d.activeNow === 'number') setLive(d) })
        .catch(() => {})
    load()
    const id = setInterval(load, 30_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  const stats = useMemo(() => {
    // Legacy values may still be in the column until tier_ladder_01 is applied.
    // liveTier, not the stored column: see the note on liveTier().
    const at = (t: string) => users.filter(u => liveTier(u) === t).length
    // One count per rung of the ladder, built from TIERS rather than named one
    // by one. The hand-written version had no 'portfolio' line, so every buyer
    // of the entry SKU appeared in none of the five rows and was missing from
    // the paid total -- a silent undercount of the cheapest, highest-volume
    // product. Adding a rung to TIERS now adds it here.
    const byTier = Object.fromEntries(TIERS.map(t => [t, at(t)])) as Record<Tier, number>
    const freeUsers = byTier.retail
    const paidUsers = TIERS.filter(t => t !== 'retail').reduce((n, t) => n + byTier[t], 0)
    const lapsedUsers  = users.filter(hasLapsed).length
    const activeUsers  = users.filter(u => u.subscription_status === 'active').length
    const pastDue      = users.filter(u => u.subscription_status === 'past_due').length
    const newThisMonth = users.filter(u => isThisMonth(u.created_at)).length
    const adminCount   = users.filter(u => u.is_admin).length
    const publishedPosts = posts.filter(p => p.published).length
    const draftPosts     = posts.filter(p => !p.published).length
    const freePosts      = posts.filter(p => normalizeTier(p.access_level) === 'retail').length
    const membersPosts   = posts.filter(p => normalizeTier(p.access_level) !== 'retail').length
    return {
      totalUsers: users.length, freeUsers, paidUsers, lapsedUsers, byTier,
      activeUsers, pastDue, newThisMonth, adminCount,
      totalPosts: posts.length, publishedPosts, draftPosts, freePosts, membersPosts,
    }
  }, [users, posts])

  const filteredUsers = useMemo(() => {
    const q = userSearch.toLowerCase()
    return users.filter(u => {
      const matchSearch = !q || u.email.toLowerCase().includes(q) || (u.full_name ?? '').toLowerCase().includes(q)
      const matchTier =
        tierFilter === 'all' ||
        (tierFilter === 'admin' && u.is_admin) ||
        (tierFilter === 'lapsed' && hasLapsed(u)) ||
        (tierFilter !== 'admin' && tierFilter !== 'lapsed' && liveTier(u) === tierFilter)
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
        (postFilter === 'free'      && normalizeTier(p.access_level) === 'retail') ||
        (postFilter === 'members'   && normalizeTier(p.access_level) !== 'retail')
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

        {/* ── Combined KPI strip (8 cards, 4×2) ── */}
        <div
          className="admin-kpi-strip"
          aria-busy={refreshing}
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px',
            opacity: refreshing ? 0.55 : 1, // dim whatever is still on screen while it's stale
            transition: 'opacity 120ms ease',
          }}
        >
          <KpiCard
            label="Active Now"
            value={live ? live.activeNow : '—'}
            sub="visitors, last 5 min"
            color="green"
            badge={live ? `${live.viewsToday.toLocaleString()} views today` : undefined}
            badgeColor="green"
            liveDot
          />
          <KpiCard
            label="Revenue"
            value={analyticsLoading ? '—' : fmtMoney(analytics?.revenueInRange ?? 0)}
            sub={analytics
              ? `${RANGE_LABELS[range].toLowerCase()} · ${fmtMoney(analytics.revenueTotal)} all-time`
              : 'loading…'}
            color="gold"
            badge={analytics?.purchaseCount ? `${analytics.purchaseCount} purchase${analytics.purchaseCount !== 1 ? 's' : ''}` : undefined}
            badgeColor="green"
          />
          <KpiCard
            label="Unique Visitors"
            value={analyticsLoading ? '—' : (analytics?.uniqueVisitors ?? 0).toLocaleString()}
            sub={analytics
              ? `${analytics.sessions.toLocaleString()} sessions · ${Math.round(analytics.bounceRate * 100)}% bounce`
              : 'loading…'}
            color="cyan"
          />
          <KpiCard
            label={RANGE_LABELS[range]}
            value={analyticsLoading ? '—' : (analytics?.viewsInRange ?? 0).toLocaleString()}
            sub={analytics ? `page views · ${analytics.totalViews.toLocaleString()} all-time` : 'page views'}
            color="green"
            badge={analytics?.viewsToday ? `${analytics.viewsToday} today` : undefined}
            badgeColor="green"
          />
          <KpiCard
            label="Total Users"
            value={stats.totalUsers}
            sub={`${stats.freeUsers} free · ${stats.paidUsers} paid${stats.lapsedUsers ? ` · ${stats.lapsedUsers} lapsed` : ''}`}
            color="cyan"
            badge={stats.newThisMonth > 0 ? `+${stats.newThisMonth} this mo` : undefined}
            badgeColor="green"
          />
          <KpiCard
            label="Paid Members"
            value={stats.paidUsers}
            sub={PAID_TIERS.map(t => `${stats.byTier[t]} ${TIER_SHORT_LABEL[t].toLowerCase()}`).join(' · ')}
            color="green"
          />
          <KpiCard
            label="Conversion"
            value={convPct ? `${convPct}%` : '—'}
            sub={analytics
              ? `${analytics.paidUsers} of ${analytics.totalUsers} users · ${fmtDuration(analytics.avgSessionSecs)} avg session`
              : 'loading…'}
            color="purple"
          />
          <KpiCard
            label="New Signups"
            value={analyticsLoading ? '—' : (analytics?.newSignups ?? 0).toLocaleString()}
            sub={RANGE_LABELS[range].toLowerCase()}
            color="gold"
          />
        </div>

        {/* ── Chart + breakdowns side by side ── */}
        <div
          className="admin-chart-grid"
          aria-busy={refreshing}
          style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', alignItems: 'start',
            opacity: refreshing ? 0.55 : 1, // dim whatever is still on screen while it's stale
            transition: 'opacity 120ms ease',
          }}
        >

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
                  {refreshing && !analyticsLoading && (
                    <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.72rem', marginLeft: '0.6rem', opacity: 0.7 }}>
                      updating…
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
                              {p.count} view{p.count !== 1 ? 's' : ''}{p.visitors > 0 && <> · {p.visitors} visitor{p.visitors !== 1 ? 's' : ''}</>}
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
                        <BreakdownRow key={p.path} label={p.path} value={p.count} total={totalRangeViews} color="var(--accent-teal)" mono />
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
                        <BreakdownRow key={r.source} label={r.source} value={r.count} total={totalRangeViews} color="var(--accent-teal)" mono />
                      ))}
                    </div>
                  ) : (
                    <p className="admin-muted" style={{ padding: '1rem 0', fontSize: '0.82rem' }}>No referrer data yet.</p>
                  )}
                </div>

                <div className="admin-breakdown-card">
                  <h3 className="admin-breakdown-card__title">Checkout Funnel — {RANGE_LABELS[range]}</h3>
                  {analytics.funnel.winVisitors > 0 ? (
                    <>
                      <div className="admin-breakdown-list">
                        <BreakdownRow label="Visited /win" value={analytics.funnel.winVisitors}    total={analytics.funnel.winVisitors} color="var(--accent-teal)" />
                        <BreakdownRow label="Clicked Buy"  value={analytics.funnel.checkoutClicks} total={analytics.funnel.winVisitors} color="var(--accent-gold)" />
                        <BreakdownRow label="Purchased"    value={analytics.funnel.purchases}      total={analytics.funnel.winVisitors} color="var(--accent-gold)" />
                      </div>
                      <div className="admin-breakdown-footer">
                        <span>
                          {((analytics.funnel.purchases / analytics.funnel.winVisitors) * 100).toFixed(1)}% visit → paid
                          {analytics.revenueInRange > 0 && <> · {fmtMoney(analytics.revenueInRange)}</>}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="admin-muted" style={{ padding: '1rem 0', fontSize: '0.82rem' }}>No /win traffic in this range yet.</p>
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
                {TIERS.map(t => (
                  <BreakdownRow
                    key={t}
                    label={TIER_SHORT_LABEL[t]}
                    value={stats.byTier[t]}
                    total={stats.totalUsers}
                    color={TIER_ROW_COLOR[t]}
                  />
                ))}
                <BreakdownRow label="Admins" value={stats.adminCount} total={stats.totalUsers} color="var(--accent-gold)" />
              </div>
              <div className="admin-breakdown-footer"><span>{stats.newThisMonth} new this month</span></div>
            </div>

            <div className="admin-breakdown-card">
              <h3 className="admin-breakdown-card__title">Content</h3>
              <div className="admin-breakdown-list">
                <BreakdownRow label="Published"    value={stats.publishedPosts} total={stats.totalPosts} color="var(--accent-teal)" />
                <BreakdownRow label="Drafts"       value={stats.draftPosts}     total={stats.totalPosts} color="var(--text-muted)" />
                <BreakdownRow label="Free Access"  value={stats.freePosts}      total={stats.totalPosts} color="var(--accent-teal)" />
                <BreakdownRow label="Members Only" value={stats.membersPosts}   total={stats.totalPosts} color="var(--accent-gold)" />
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
                        color={d.device === 'mobile' ? 'var(--accent-teal)' : d.device === 'tablet' ? 'var(--accent-gold)' : 'var(--accent-gold)'}
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

                {analytics.utmSources.length > 0 && (
                  <div className="admin-breakdown-card">
                    <h3 className="admin-breakdown-card__title">Campaigns</h3>
                    <div className="admin-breakdown-list">
                      {analytics.utmSources.slice(0, 7).map(u => (
                        <BreakdownRow
                          key={u.source}
                          label={u.source}
                          value={u.count}
                          total={analytics.utmSources.reduce((s, x) => s + x.count, 0)}
                          color="var(--accent-teal)"
                          mono
                        />
                      ))}
                    </div>
                    <div className="admin-breakdown-footer"><span>views from utm_source-tagged visits</span></div>
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
                {TIER_FILTERS.map(f => (
                  <button
                    key={f}
                    className={`admin-filter-btn ${tierFilter === f ? 'admin-filter-btn--active' : ''}`}
                    onClick={() => setTierFilter(f)}
                  >
                    {filterLabel(f)}
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
                    <th>Access</th>
                    <th>Billing</th>
                    <th>Last Active</th>
                    <th>Comp</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr><td colSpan={6} className="admin-table__empty">No users found.</td></tr>
                  ) : filteredUsers.map(user => {
                    const tier = liveTier(user)
                    const lapsed = hasLapsed(user)
                    const source = accessSource(user)
                    return (
                    <tr key={user.id}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-avatar">{(user.full_name ?? user.email).charAt(0).toUpperCase()}</div>
                          <div>
                            <div className="admin-user-name" title={`Joined ${fmt(user.created_at)}`}>
                              {user.full_name ?? <span className="admin-muted">—</span>}
                              {user.is_admin && <span className="admin-badge admin-badge--gold" style={{ marginLeft: '6px' }}>Admin</span>}
                            </div>
                            <div className="admin-user-email">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {/* The rung they can open TODAY, not the one they last
                            paid for. A lapsed member reads Free, with what they
                            had underneath it. */}
                        <span className={`nav__user-tier ${TIER_CLASS[user.is_admin ? 'admin' : tier]}`}>
                          {user.is_admin ? 'Admin' : TIER_SHORT_LABEL[tier]}
                        </span>
                        {lapsed && (
                          <div className="admin-muted admin-cell-note">
                            was {TIER_SHORT_LABEL[normalizeTier(user.subscription_tier)]}
                          </div>
                        )}
                      </td>
                      <td>
                        {user.is_admin ? (
                          <span className="admin-muted">always</span>
                        ) : user.access_expires_at ? (
                          <>
                            <span className={lapsed ? 'admin-badge admin-badge--red' : undefined}>
                              {lapsed ? `ended ${fmt(user.access_expires_at)}` : `until ${fmt(user.access_expires_at)}`}
                            </span>
                            {source && <div className="admin-muted admin-cell-note">{source}</div>}
                          </>
                        ) : <span className="admin-muted">—</span>}
                      </td>
                      <td>
                        {user.subscription_status ? (
                          <span className={`admin-badge ${STATUS_COLOR[user.subscription_status] ?? ''}`}>
                            {user.subscription_status.replace('_', ' ')}
                          </span>
                        ) : user.stripe_customer_id ? (
                          <span className="admin-muted">stripe</span>
                        ) : <span className="admin-muted">—</span>}
                      </td>
                      <td className="admin-muted">{timeAgo(user.last_seen_at)}</td>
                      <td>
                        <CompCell user={user} onDone={() => router.refresh()} />
                      </td>
                    </tr>
                  )})}
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
              <div className="admin-empty-state">
                <p>No blog posts yet.</p>
                <Link href="/admin/posts/new" className="btn btn--primary btn--sm">Create your first post</Link>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Which release is actually deployed. `main` is production and every
          push builds, so a tag on its own does not tell you whether Vercel
          has caught up -- this number does. See docs/RELEASING.md. */}
      <footer className="admin-version">
        v{process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'}
      </footer>
    </main>
  )
}

/**
 * Comp, extend or revoke one member's access, inline in the row.
 *
 * Writes the PASS slot through /api/admin/users/[id]; the subscription slot is
 * Stripe's and is never touched from here. That is what lets a comp sit on top
 * of a paid subscription without either one clobbering the other, and it is why
 * Revoke cannot cancel something a member is paying for.
 */
function CompCell({ user, onDone }: { user: User; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [tier, setTier] = useState<Tier>('private')
  const [until, setUntil] = useState('season')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A pass that has already run out is not a comp, it is a leftover. Labelling
  // the row "Private pass / Change" for somebody whose pass ended in May reads
  // as though they still have it.
  const comped =
    !!user.pass_tier &&
    !!user.pass_expires_at &&
    new Date(user.pass_expires_at).getTime() > Date.now()

  async function send(body: Record<string, unknown>) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      setOpen(false)
      onDone()
    } catch (e: any) {
      setError(e.message ?? 'Failed')
    } finally {
      setBusy(false)
    }
  }

  if (user.is_admin) return <span className="admin-muted">—</span>

  if (!open) {
    return (
      <div className="admin-comp">
        {comped && (
          <span className="admin-muted admin-cell-note">
            {TIER_SHORT_LABEL[normalizeTier(user.pass_tier)]} pass
          </span>
        )}
        <button className="admin-action-btn" onClick={() => { setTier(comped ? normalizeTier(user.pass_tier) : 'private'); setOpen(true) }}>
          {comped ? 'Change' : 'Comp'}
        </button>
        {error && <div className="admin-comp__error">{error}</div>}
      </div>
    )
  }

  return (
    <div className="admin-comp admin-comp--open">
      <select className="admin-comp__field" value={tier} onChange={e => setTier(e.target.value as Tier)}>
        {PAID_TIERS.map(t => <option key={t} value={t}>{TIER_SHORT_LABEL[t]}</option>)}
      </select>
      <select className="admin-comp__field" value={until} onChange={e => setUntil(e.target.value)}>
        <option value="season">To the Super Bowl</option>
        <option value="30">30 days</option>
        <option value="365">1 year</option>
      </select>
      <div className="admin-comp__actions">
        <button
          className="admin-action-btn admin-action-btn--primary"
          disabled={busy}
          onClick={() => send({
            action: 'grant',
            tier,
            expiresAt: until === 'season'
              ? 'season'
              : new Date(Date.now() + Number(until) * 86_400_000).toISOString(),
          })}
        >
          {busy ? '…' : 'Apply'}
        </button>
        {comped && (
          <button className="admin-action-btn" disabled={busy} onClick={() => send({ action: 'revoke' })}>
            Revoke
          </button>
        )}
        <button className="admin-action-btn" disabled={busy} onClick={() => { setOpen(false); setError(null) }}>
          Cancel
        </button>
      </div>
      {error && <div className="admin-comp__error">{error}</div>}
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, badge, badgeColor, liveDot,
}: {
  label: string
  value: string | number
  sub: string
  color: 'cyan' | 'green' | 'purple' | 'gold'
  badge?: string
  badgeColor?: 'green' | 'muted'
  liveDot?: boolean
}) {
  return (
    <div className="admin-kpi-card">
      <div className="admin-kpi-card__top">
        <span className="admin-kpi-card__label">
          {liveDot && <span className="admin-live-dot" aria-hidden />}
          {label}
        </span>
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
