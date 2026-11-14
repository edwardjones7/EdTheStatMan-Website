'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { Person, PurchaseRow } from '@/lib/admin-people'
import type { Ops } from '@/lib/admin-people-server'
import type { ProofData } from '@/lib/proof'
import ContentView from '@/components/admin/ContentView'
import FunnelView from '@/components/admin/FunnelView'
import OverviewView from '@/components/admin/OverviewView'
import RevenueView from '@/components/admin/RevenueView'
import SubscribersView from '@/components/admin/SubscribersView'
import SystemView from '@/components/admin/SystemView'
import TrafficView from '@/components/admin/TrafficView'
import UsersView, { USER_FILTERS, type UserFilter } from '@/components/admin/UsersView'
import type { AdminPost, AnalyticsData, Go, Range, View } from '@/components/admin/types'
import { Notice } from '@/components/admin/ui'
import '@/components/admin/admin.css'

const I = (d: ReactNode) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

const VIEWS: { key: View; label: string; group: string; title: string; sub: string; icon: ReactNode }[] = [
  { key: 'today', group: 'Daily', label: 'Today', title: 'Today', sub: 'What needs you, and how the site is doing',
    icon: I(<><path d="M3 12l9-8 9 8" /><path d="M5 10v10h14V10" /></>) },
  { key: 'traffic', group: 'Growth', label: 'Traffic', title: 'Traffic', sub: 'Who visits, from where, and what they read',
    icon: I(<><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>) },
  { key: 'funnel', group: 'Growth', label: 'Funnel', title: 'Funnel', sub: 'Visit, account, trial, paid, and which sources bring buyers',
    icon: I(<path d="M3 4h18l-7 8v6l-4 2v-8z" />) },
  { key: 'revenue', group: 'Growth', label: 'Revenue', title: 'Revenue', sub: 'Every sale, by product and term',
    icon: I(<><path d="M12 3v18" /><path d="M17 7H9.5a3 3 0 000 6h5a3 3 0 010 6H6" /></>) },
  { key: 'users', group: 'People', label: 'Users', title: 'Users', sub: 'Every account and the membership it holds',
    icon: I(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 4.5a3.5 3.5 0 010 7" /><path d="M18 14.5a6.5 6.5 0 013.5 5.5" /></>) },
  { key: 'subscribers', group: 'People', label: 'Subscribers', title: 'Subscribers', sub: 'The email list',
    icon: I(<><rect x="3" y="5" width="18" height="14" rx="1" /><path d="M3 7l9 6 9-6" /></>) },
  { key: 'content', group: 'Product', label: 'Picks & Content', title: 'Picks & Content', sub: 'Records, the pick queue and posts',
    icon: I(<><path d="M5 3h10l4 4v14H5z" /><path d="M9 12h6M9 16h6M9 8h3" /></>) },
  { key: 'system', group: 'Operations', label: 'System health', title: 'System health', sub: 'Scheduled jobs, and how far to trust the numbers',
    icon: I(<path d="M3 12h4l3-7 4 14 3-7h4" />) },
]

/** Old ?view= and ?tab= links still land somewhere sensible. */
const LEGACY_VIEW: Record<string, View> = {
  overview: 'today', growth: 'traffic', audience: 'users', posts: 'content', picks: 'content',
}

function parseView(value: string | undefined): View {
  if (VIEWS.some(v => v.key === value)) return value as View
  return LEGACY_VIEW[value ?? ''] ?? 'today'
}

const RANGED: View[] = ['today', 'traffic', 'funnel', 'revenue', 'subscribers']

// Cached range payloads older than this are still shown instantly, then
// refreshed in the background.
const CACHE_TTL_MS = 60_000

const DAY = 24 * 60 * 60 * 1000

function toDateStr(ms: number): string {
  return new Date(ms).toISOString().split('T')[0]
}

function defaultWeekStart(): string {
  return toDateStr(Date.now() - 6 * DAY)
}

interface Props {
  people: Person[]
  purchases: PurchaseRow[]
  peopleError: string | null
  ops: Ops
  /** Null when posts failed to load. */
  posts: AdminPost[] | null
  records: ProofData['books'] | null
  initialView?: string
  /** Prefetched on the server for the default ('month') range. */
  initialAnalytics: AnalyticsData
}

export default function AdminDashboard({
  people, purchases, peopleError, ops, posts, records, initialView, initialAnalytics,
}: Props) {
  const [view, setView] = useState<View>(() => parseView(initialView))
  const [userFilter, setUserFilter] = useState<UserFilter>('all')
  const [range, setRange] = useState<Range>('month')
  const [weekStart, setWeekStart] = useState(defaultWeekStart)
  const [analytics, setAnalytics] = useState<AnalyticsData>(initialAnalytics)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [live, setLive] = useState<{ activeNow: number; viewsToday: number } | null>(null)

  // history, not the router: a router navigation would re-run every query on
  // the server just to change which view is showing.
  const show = useCallback((next: View) => {
    setView(next)
    window.history.replaceState(null, '', next === 'today' ? '/admin' : `/admin?view=${next}`)
    window.scrollTo({ top: 0 })
  }, [])

  const go = useCallback<Go>((next, filter) => {
    if (filter && (USER_FILTERS as readonly string[]).includes(filter)) setUserFilter(filter as UserFilter)
    show(next)
  }, [show])

  const accountCount = useMemo(() => people.filter(p => p.confirmed && !p.is_admin).length, [people])
  const subscriberCount = useMemo(() => people.filter(p => p.subscriber).length, [people])
  const badJobs = (ops.jobs ?? []).filter(j => j.state === 'failed' || j.state === 'late').length
  const badge: Partial<Record<View, { n: number; warn?: boolean }>> = {
    users: { n: accountCount },
    subscribers: { n: subscriberCount },
    ...(ops.pendingPicks ? { content: { n: ops.pendingPicks, warn: true } } : {}),
    ...(badJobs ? { system: { n: badJobs, warn: true } } : {}),
  }
  const current = VIEWS.find(v => v.key === view)!

  useEffect(() => { setWeekStart(defaultWeekStart()) }, [range])

  // Per-range cache, seeded with the server-rendered 'month' payload. Switching
  // to a range that's already been loaded is instant; a stale entry is shown
  // straight away and refreshed behind it.
  const cacheRef = useRef<Map<string, { data: AnalyticsData; ts: number }>>(
    new Map([['month', { data: initialAnalytics, ts: Date.now() }]])
  )
  // Guards against an earlier, slower response overwriting a later selection.
  const activeKeyRef = useRef('month')

  useEffect(() => {
    const key = range === 'week' ? `week:${weekStart}` : range
    activeKeyRef.current = key
    setLoadError(false)

    const cached = cacheRef.current.get(key)
    if (cached) {
      setAnalytics(cached.data)
      if (Date.now() - cached.ts < CACHE_TTL_MS) {
        setRefreshing(false)
        return // fresh enough, no request
      }
    }
    setRefreshing(true)

    const params = new URLSearchParams({ range, totals: '0' }) // all-time figures already held
    if (range === 'week') params.set('weekStart', weekStart)

    let cancelled = false
    fetch(`/api/admin/analytics?${params}`, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: AnalyticsData) => {
        if (cancelled) return
        const merged = { ...d, totalViews: initialAnalytics.totalViews }
        cacheRef.current.set(key, { data: merged, ts: Date.now() })
        if (activeKeyRef.current === key) {
          setAnalytics(merged)
          setRefreshing(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRefreshing(false)
          setLoadError(true)
        }
      })

    return () => { cancelled = true }
    // initialAnalytics only seeds the refs above, which ignore later values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, weekStart])

  // Live stats — poll every 2 min so the dashboard stays current without reloads
  useEffect(() => {
    let cancelled = false
    // Skipped while the tab is hidden: a dashboard left open overnight was
    // ~720 auth + DB round trips a day for nobody. Catches up on return.
    const load = () => {
      if (document.visibilityState === 'hidden') return
      fetch('/api/admin/analytics/live', { cache: 'no-store' })
        .then(r => r.json())
        .then(d => { if (!cancelled && typeof d.activeNow === 'number') setLive(d) })
        .catch(() => {})
    }
    load()
    const id = setInterval(load, 120_000)
    document.addEventListener('visibilitychange', load)
    return () => { cancelled = true; clearInterval(id); document.removeEventListener('visibilitychange', load) }
  }, [])

  const hasRange = RANGED.includes(view)
  const stepWeek = (days: number) => setWeekStart(s =>
    toDateStr(Math.min(new Date(s).getTime() + days * DAY, new Date(defaultWeekStart()).getTime())))

  const groups = VIEWS.reduce<{ name: string; items: typeof VIEWS }[]>((acc, v) => {
    const last = acc[acc.length - 1]
    if (last && last.name === v.group) last.items.push(v)
    else acc.push({ name: v.group, items: [v] })
    return acc
  }, [])

  return (
    <main className="admin-page adm-app">
      <nav className="adm-side" aria-label="Admin sections">
        <div className="adm-side__head">Admin</div>
        {groups.map(g => (
          <div key={g.name} className="adm-side__group">
            <div className="adm-side__label">{g.name}</div>
            {g.items.map(v => (
              <button
                key={v.key}
                type="button"
                className={`adm-nav${view === v.key ? ' is-on' : ''}`}
                aria-current={view === v.key ? 'page' : undefined}
                onClick={() => show(v.key)}
              >
                {v.icon}
                <span>{v.label}</span>
                {badge[v.key] && (
                  <span className={`adm-nav__count${badge[v.key]!.warn ? ' is-warn' : ''}`}>
                    {badge[v.key]!.n.toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>
        ))}
        <div className="adm-side__foot">
          {live && (
            <span className="adm-live">
              <span className="admin-live-dot" aria-hidden />
              {live.activeNow} on the site now
            </span>
          )}
          <Link href="/">View site</Link>
          <span>v{process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown'}</span>
        </div>
      </nav>

      <div className="admin-container adm-main">

        <div className="admin-header">
          <div>
            <h1 className="admin-header__title">{current.title}</h1>
            <p className="adm-sub">
              {current.sub}
              {live && view === 'today' && <> · {live.viewsToday.toLocaleString()} views today</>}
            </p>
          </div>
          {hasRange && (
            <div className="adm-controls">
              {range === 'week' && (
                <div className="adm-weeknav">
                  <button type="button" className="admin-action-btn" aria-label="Previous week" onClick={() => stepWeek(-7)}>←</button>
                  <input
                    type="date"
                    className="admin-comp__field"
                    aria-label="Week starting"
                    value={weekStart}
                    max={defaultWeekStart()}
                    onChange={e => e.target.value && setWeekStart(e.target.value)}
                  />
                  <button
                    type="button"
                    className="admin-action-btn"
                    aria-label="Next week"
                    disabled={weekStart >= defaultWeekStart()}
                    onClick={() => stepWeek(7)}
                  >→</button>
                </div>
              )}
              <div className="admin-filters" style={{ margin: 0 }}>
                {(['week', 'month', 'year'] as Range[]).map(r => (
                  <button
                    key={r}
                    type="button"
                    className={`admin-filter-btn ${range === r ? 'admin-filter-btn--active' : ''}`}
                    aria-pressed={range === r}
                    onClick={() => setRange(r)}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {peopleError && (
          <Notice>Couldn&rsquo;t load members and revenue, so those figures are missing, not zero. Reload to try again.</Notice>
        )}
        {loadError && <Notice>Couldn&rsquo;t load that range. The figures below are from the last one that worked.</Notice>}
        {hasRange && analytics.failed.length > 0 && (
          <Notice>Some traffic figures failed to load ({analytics.failed.join(', ')}). Treat zeros there as unknown.</Notice>
        )}

        {view === 'today' && (
          <OverviewView
            people={people}
            purchases={purchases}
            peopleFailed={!!peopleError}
            ops={ops}
            analytics={analytics}
            range={range}
            loading={refreshing}
            go={go}
          />
        )}
        {view === 'traffic' && <TrafficView analytics={analytics} loading={refreshing} />}
        {view === 'funnel' && <FunnelView people={people} purchases={purchases} analytics={analytics} />}
        {view === 'revenue' && (
          <RevenueView
            people={people}
            purchases={purchases}
            peopleFailed={!!peopleError}
            analytics={analytics}
            range={range}
            go={go}
          />
        )}
        {view === 'users' && <UsersView people={people} filter={userFilter} setFilter={setUserFilter} />}
        {view === 'subscribers' && (
          <SubscribersView people={people} purchases={purchases} analytics={analytics} unsubscribes={ops.unsubscribes} />
        )}
        {view === 'content' && (
          <ContentView
            posts={posts}
            records={records}
            pendingPicks={ops.pendingPicks}
            startOn={initialView === 'posts' ? 'posts' : 'picks'}
          />
        )}
        {/* Which release is deployed lives in the sidebar footer and on System
            health: `main` is production and every push builds, so a tag alone
            does not say whether Vercel has caught up. See docs/RELEASING.md. */}
        {view === 'system' && <SystemView ops={ops} />}
      </div>
    </main>
  )
}
