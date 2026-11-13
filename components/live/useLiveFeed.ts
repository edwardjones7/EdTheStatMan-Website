'use client'

import { useEffect, useState } from 'react'
import type { LiveFeed } from '@/lib/live/types'

/**
 * The whole /api/live feed, polled every 60s while the tab is visible and
 * shared by everything on the page that asks for it (the ticker and the front
 * page's My teams strip): one poll, however many subscribers. The route is
 * CDN-cached, so this costs ESPN and Supabase nothing per visitor.
 *
 * Separate from LiveProvider, which is the front page's own faster poll with
 * its own context; this one runs on every page, so it stays on the slow clock.
 */
const INTERVAL = 60_000

let feed: LiveFeed | null = null
const subs = new Set<(f: LiveFeed | null) => void>()
let timer: ReturnType<typeof setTimeout> | null = null
let inflight = false

async function load() {
  if (timer) { clearTimeout(timer); timer = null }
  if (typeof document === 'undefined' || document.visibilityState !== 'visible' || subs.size === 0) return
  if (!inflight) {
    inflight = true
    try {
      const res = await fetch('/api/live')
      if (res.ok) {
        feed = (await res.json()) as LiveFeed
        subs.forEach(cb => cb(feed))
      }
    } catch {
      /* keep the last feed */
    } finally {
      inflight = false
    }
  }
  if (subs.size > 0 && document.visibilityState === 'visible') timer = setTimeout(load, INTERVAL)
}

function onVisible() {
  if (document.visibilityState === 'visible') load()
  else if (timer) { clearTimeout(timer); timer = null }
}

export function useLiveFeed(): LiveFeed | null {
  const [value, setValue] = useState<LiveFeed | null>(feed)
  useEffect(() => {
    subs.add(setValue)
    if (subs.size === 1) {
      document.addEventListener('visibilitychange', onVisible)
      load()
    } else if (feed) {
      setValue(feed)
    }
    return () => {
      subs.delete(setValue)
      if (subs.size === 0) {
        document.removeEventListener('visibilitychange', onVisible)
        if (timer) { clearTimeout(timer); timer = null }
      }
    }
  }, [])
  return value
}
