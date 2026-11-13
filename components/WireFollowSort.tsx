'use client'

import { useEffect } from 'react'
import { readFollows, onFollowsChange, followKey } from '@/lib/follows'

/**
 * Moves Wire stories about followed teams (lib/follows.ts) to the front of the
 * grid. The list is server-rendered and identical for everyone; this only sets
 * CSS `order` on the items, so it needs no re-render, the markup stays the
 * cacheable one, and without JavaScript the page is simply in its usual order.
 *
 * Each <li> carries data-teams="nfl|KC nfl|BUF".
 */
export default function WireFollowSort({ selector }: { selector: string }) {
  useEffect(() => {
    const apply = () => {
      const followed = new Set(readFollows().map(t => followKey(t.sport, t.abbrev)))
      document.querySelectorAll<HTMLElement>(`${selector} > [data-teams]`).forEach(li => {
        const hit = (li.dataset.teams ?? '').split(' ').some(k => k && followed.has(k))
        li.style.order = hit ? '-1' : ''
        li.classList.toggle('is-followed', hit)
      })
    }
    apply()
    return onFollowsChange(apply)
  }, [selector])
  return null
}
