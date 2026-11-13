'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { LiveFeed, LiveGame } from '@/lib/live/types'
import '@/styles/live.css'

/**
 * One poll of /api/live for the whole front page; every live widget reads it
 * from context. Fast while something is live or about to start, slow
 * otherwise, and stopped while the tab is hidden. The route is CDN-cached, so
 * a fast poll costs nothing per visitor upstream.
 */
const FAST_MS = 30_000
const SLOW_MS = 180_000
const SOON_MS = 15 * 60_000

interface LiveCtx {
  games: LiveGame[]
  byId: Map<string, LiveGame>
  ready: boolean
  updatedAt: string | null
}

const Ctx = createContext<LiveCtx>({ games: [], byId: new Map(), ready: false, updatedAt: null })

export function useLive(): LiveCtx {
  return useContext(Ctx)
}

function busy(games: LiveGame[], now: number): boolean {
  return games.some(g =>
    g.state === 'in' ||
    (g.state === 'pre' && g.kickoff != null && new Date(g.kickoff).getTime() - now < SOON_MS)
  )
}

export default function LiveProvider({ children, sports }: { children: React.ReactNode; sports?: string[] }) {
  // One league on a Desk page; every league on the front page.
  const url = sports && sports.length ? `/api/live?sports=${[...sports].sort().join(',')}` : '/api/live'
  const [feed, setFeed] = useState<LiveFeed | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    const schedule = (games: LiveGame[]) => {
      if (timer.current) clearTimeout(timer.current)
      if (document.visibilityState !== 'visible') return
      timer.current = setTimeout(load, busy(games, Date.now()) ? FAST_MS : SLOW_MS)
    }

    async function load() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error(String(res.status))
        const next = (await res.json()) as LiveFeed
        if (cancelled) return
        setFeed(next)
        schedule(next.games)
      } catch {
        // Keep showing what we have; try again on the slow clock.
        if (!cancelled) schedule([])
      }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    load()

    return () => {
      cancelled = true
      if (timer.current) clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [url])

  const value = useMemo<LiveCtx>(() => {
    const games = feed?.games ?? []
    const byId = new Map<string, LiveGame>()
    for (const g of games) if (g.id) byId.set(g.id, g)
    return { games, byId, ready: feed != null, updatedAt: feed?.updatedAt ?? null }
  }, [feed])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
