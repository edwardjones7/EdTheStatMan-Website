'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AudienceFilter, Person, PurchaseRow } from '@/lib/admin-people'
import type { Ops } from '@/lib/admin-people-server'
import type { ProofData } from '@/lib/proof'
import AudienceView from '@/components/admin/AudienceView'
import ContentView from '@/components/admin/ContentView'
import GrowthView from '@/components/admin/GrowthView'
import OverviewView from '@/components/admin/OverviewView'
import type { AdminPost, AnalyticsData, Go, Range, View } from '@/components/admin/types'
import { Notice } from '@/components/admin/ui'
import '@/components/admin/admin.css'

const VIEWS: { key: View; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'growth', label: 'Growth' },
  { key: 'audience', label: 'Audience' },
  { key: 'content', label: 'Picks & Content' },
]

/** Old ?tab= links still land somewhere sensible. */
const LEGACY_VIEW: Record<string, View> = { users: 'audience', posts: 'content', picks: 'content' }

function parseView(value: string | undefined): View {
  if (VIEWS.some(v => v.key === value)) return value as View
  return LEGACY_VIEW[value ?? ''] ?? 'overview'
}

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
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all')
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
    window.history.replaceState(null, '', next === 'overview' ? '/admin' : `/admin?view=${next}`)
  }, [])

  const go = useCallback<Go>((next, filter) => {
    if (filter) setAudienceFilter(filter)
    show(next)
  }, [show])

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

  const hasRange = view === 'overview' || view === 'growth'
  const stepWeek = (days: number) => setWeekStart(s =>
    toDateStr(Math.min(new Date(s).getTime() + days * DAY, new Date(defaultWeekStart()).getTime())))

  return (
    <main className="admin-page">
      <div className="admin-container">

        <div className="admin-header">
          <div>
            <h1 className="admin-header__title">Admin Dashboard</h1>
            {live && (
              <p className="adm-live">
                <span className="admin-live-dot" aria-hidden />
                {live.activeNow} on the site now · {live.viewsToday.toLocaleString()} views today
              </p>
            )}
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

        <div className="admin-tabs" role="tablist">
          {VIEWS.map(v => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              className={`admin-tab ${view === v.key ? 'admin-tab--active' : ''}`}
              onClick={() => show(v.key)}
            >
              {v.label}
              {v.key === 'audience' && <span className="admin-tab__count">{people.length}</span>}
              {v.key === 'content' && !!ops.pendingPicks && <span className="admin-tab__count">{ops.pendingPicks}</span>}
            </button>
          ))}
        </div>

        {peopleError && (
          <Notice>Couldn&rsquo;t load members and revenue, so those figures are missing, not zero. Reload to try again.</Notice>
        )}
        {loadError && <Notice>Couldn&rsquo;t load that range. The figures below are from the last one that worked.</Notice>}
        {hasRange && analytics.failed.length > 0 && (
          <Notice>Some traffic figures failed to load ({analytics.failed.join(', ')}). Treat zeros there as unknown.</Notice>
        )}

        {view === 'overview' && (
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
        {view === 'growth' && <GrowthView people={people} purchases={purchases} analytics={analytics} />}
        {view === 'audience' && (
          <AudienceView
            people={people}
            filter={audienceFilter}
            setFilter={setAudienceFilter}
            unsubscribeTracked={ops.unsubscribes !== null}
          />
        )}
        {view === 'content' && (
          <ContentView
            posts={posts}
            records={records}
            pendingPicks={ops.pendingPicks}
            startOn={initialView === 'posts' ? 'posts' : 'picks'}
          />
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
