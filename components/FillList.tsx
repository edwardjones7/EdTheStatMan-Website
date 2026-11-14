'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/** Matches the three-column front page (styles/home.css: .front-fill). */
const WIDE = '(min-width: 769px)'

/**
 * A list that shows as many items as fit the space it is given, and no more.
 *
 * WHY. The front page's three columns end flush: the last card in each column
 * stretches to the tallest column. A fixed-length list in a stretched card left
 * a block of empty space under it, and how much depended on the day's data. So
 * these lists get more items than they need, and this hides the ones that
 * would not fit. The space fills itself, whichever column happens to be tallest.
 *
 * HOW. The list is `contain: size` with a min-height (home.css), so it never
 * makes its column taller: it only takes up what the other columns leave. On
 * every resize or change of items, it shows every item, measures, and hides
 * the ones whose bottom edge falls past the list's height. `columns` hides
 * whole rows, so a two-column grid never ends on a lone half row.
 *
 * Below the three-column layout the cards stack and nothing is stretched, so
 * it simply shows the first `fallback` items.
 */
export default function FillList({
  children,
  className,
  fallback,
  columns = 1,
}: {
  children: ReactNode
  className: string
  fallback: number
  columns?: number
}) {
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const ul = ref.current
    if (!ul) return
    const mq = window.matchMedia(WIDE)
    let frame = 0

    const fit = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const items = Array.from(ul.children) as HTMLElement[]
        for (const el of items) {
          el.style.display = ''
          el.style.paddingTop = ''
          el.style.paddingBottom = ''
        }
        let show: number
        const limit = ul.clientHeight
        if (!mq.matches) {
          show = fallback
        } else {
          show = items.findIndex(el => el.offsetTop + el.offsetHeight > limit + 1)
          if (show === -1) show = items.length
          show -= show % columns
          // Never empty: one row is better than a blank card.
          show = Math.max(show, Math.min(columns, items.length))
        }
        items.forEach((el, i) => { el.style.display = i < show ? '' : 'none' })
        if (!mq.matches || show === 0) return

        // Whatever is left is less than one more row. Share it out as padding
        // on every visible row, so the last item ends flush with the card
        // instead of leaving a strip of empty space under it.
        const last = items[show - 1]
        const leftover = limit - (last.offsetTop + last.offsetHeight)
        const rows = Math.ceil(show / columns)
        // When the whole list fits with room to spare there is nothing to
        // hide, so a large leftover is real space; cap it rather than balloon
        // a short list.
        const extra = Math.min(Math.max(0, leftover) / rows, 28)
        if (extra < 1) return
        for (const el of items.slice(0, show)) {
          const cs = getComputedStyle(el)
          el.style.paddingTop = `${parseFloat(cs.paddingTop) + extra / 2}px`
          el.style.paddingBottom = `${parseFloat(cs.paddingBottom) + extra / 2}px`
        }
      })
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(ul)
    // Items change under us when a tab switches the list (NewsCard).
    const mo = new MutationObserver(fit)
    mo.observe(ul, { childList: true })
    mq.addEventListener('change', fit)
    return () => {
      cancelAnimationFrame(frame)
      ro.disconnect()
      mo.disconnect()
      mq.removeEventListener('change', fit)
    }
  }, [fallback, columns])

  return <ul ref={ref} className={`${className} front-fill`}>{children}</ul>
}
