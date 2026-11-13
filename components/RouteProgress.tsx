'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import '@/styles/loading.css'

type State = 'idle' | 'loading' | 'done'

/**
 * A thin bar across the top of the screen while a page loads. Every page is
 * rendered per visitor (live lines, scores, gated picks), so a click can take a
 * moment; this shows that something is happening from the instant of the click.
 *
 * It starts on a click of a same-site link (listened for in the capture phase,
 * because next/link calls preventDefault before a bubbling listener would see
 * it) and finishes when the pathname or query changes.
 */
export default function RouteProgress() {
  const pathname = usePathname()
  const search = useSearchParams()
  const [state, setState] = useState<State>('idle')

  // The new route has rendered.
  useEffect(() => {
    setState(s => (s === 'loading' ? 'done' : s))
  }, [pathname, search])

  // Fade out, then reset to zero width for the next navigation.
  useEffect(() => {
    if (state === 'done') {
      const t = setTimeout(() => setState('idle'), 450)
      return () => clearTimeout(t)
    }
    if (state === 'loading') {
      // Never leave the bar hanging if a navigation is abandoned.
      const t = setTimeout(() => setState('done'), 15000)
      return () => clearTimeout(t)
    }
  }, [state])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a')
      if (!a || !a.href || a.hasAttribute('download')) return
      if (a.target && a.target !== '_self') return
      const url = new URL(a.href, location.href)
      if (url.origin !== location.origin) return
      // Same page (or only the #hash changes): nothing will load.
      if (url.pathname === location.pathname && url.search === location.search) return
      setState('loading')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  return <div className={`route-progress route-progress--${state}`} aria-hidden="true" />
}
