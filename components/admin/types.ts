import type { RangeAnalytics, GlobalTotals } from '@/lib/admin-analytics'
import type { AudienceFilter } from '@/lib/admin-people'

export type AnalyticsData = RangeAnalytics & GlobalTotals

export type View = 'overview' | 'growth' | 'audience' | 'content'
export type Range = 'week' | 'month' | 'year'

export interface AdminPost {
  id: string
  title: string
  slug: string
  tag: string
  access_level: string
  published: boolean
  published_at: string | null
  created_at: string
}

/** Jumps from an alert on the Overview to the place that deals with it. */
export type Go = (view: View, filter?: AudienceFilter) => void
