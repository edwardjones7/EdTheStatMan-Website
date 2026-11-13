'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function animateCounter(element: HTMLElement) {
  const target = parseFloat(element.dataset.count || '0')
  const duration = 2000
  const start = performance.now()
  const prefix = element.dataset.prefix || ''
  const suffix = element.dataset.suffix || ''
  const decimals = element.dataset.decimals ? parseInt(element.dataset.decimals) : 0

  function update(currentTime: number) {
    const elapsed = currentTime - start
    const progress = Math.min(elapsed / duration, 1)
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
    element.textContent = prefix + (target * eased).toFixed(decimals) + suffix
    if (progress < 1) requestAnimationFrame(update)
  }

  requestAnimationFrame(update)
}

const REVEAL = '.reveal, .reveal-left, .reveal-right, .reveal-scale, .stagger-children'

/** On screen now (or above it), so it must never be hidden to animate in. */
function inView(el: Element): boolean {
  const r = el.getBoundingClientRect()
  return r.top < window.innerHeight && r.bottom > -1
}

/**
 * Blank first paint, fixed (Nov 2026). `.reveal` used to be opacity 0 in plain
 * CSS, so /vault and /desk painted empty until this script hydrated and the
 * observer fired -- and with no JavaScript at all, stayed empty. Now the hiding
 * rules apply only under html.reveal-on, which is added here, AFTER everything
 * already on screen has been marked .visible. So: no JS, nothing hidden; above
 * the fold, visible from the first paint and never faded; below the fold, the
 * scroll animation as before. Reduced motion never turns it on.
 */
function revealInView(root: ParentNode) {
  const els: Element[] = []
  if (root instanceof Element && root.matches(REVEAL)) els.push(root)
  root.querySelectorAll(REVEAL).forEach(el => els.push(el))
  for (const el of els) if (!el.classList.contains('visible') && inView(el)) el.classList.add('visible')
}

function enableReveal() {
  const html = document.documentElement
  if (html.classList.contains('reveal-on')) return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  revealInView(document)
  html.classList.add('reveal-on')
}

function init() {
  enableReveal()

  // Scroll reveal animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible')
        if (!entry.target.classList.contains('counter')) observer.unobserve(entry.target)
      }
    })
  }, { root: null, rootMargin: '0px 0px -80px 0px', threshold: 0.1 })

  document.querySelectorAll(REVEAL).forEach(el => {
    observer.observe(el)
  })

  // System bars animation
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = (entry.target as HTMLElement).dataset.width
        if (target) {
          (entry.target as HTMLElement).style.width = target + '%'
          barObserver.unobserve(entry.target)
        }
      }
    })
  }, { threshold: 0.3 })

  document.querySelectorAll('.system-card__bar-fill, .perf-winbar__fill, .perf-ratio__seg').forEach(bar => {
    barObserver.observe(bar)
  })

  // Counter animations — clear counted flag so they re-animate after content save
  document.querySelectorAll<HTMLElement>('[data-count]').forEach(el => {
    delete el.dataset.counted
  })

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !(entry.target as HTMLElement).dataset.counted) {
        animateCounter(entry.target as HTMLElement)
        ;(entry.target as HTMLElement).dataset.counted = 'true'
      }
    })
  }, { threshold: 0.5 })

  document.querySelectorAll('[data-count]').forEach(counter => counterObserver.observe(counter))

  // Chart bar animations
  const chartContainer = document.querySelector('.chart-bars')
  if (chartContainer) {
    const chartObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.chart-bar').forEach((bar, index) => {
            setTimeout(() => {
              (bar as HTMLElement).style.height = (bar as HTMLElement).dataset.height + '%'
            }, index * 50)
          })
          chartObserver.unobserve(entry.target)
        }
      })
    }, { threshold: 0.3 })
    chartObserver.observe(chartContainer)
  }

  // Everything above is a snapshot of the DOM as it stands right now, and on a
  // client navigation that DOM is the *previous* page. This effect re-runs on
  // `pathname`, which the App Router updates about 215ms into a navigation,
  // while the old page is still the only thing rendered -- the new one arrives
  // up to a couple of seconds later. So the snapshot observed the page being
  // left, and nothing ever observed the page being arrived at.
  //
  // That is not a cosmetic miss. `.reveal` is `opacity: 0` until this observer
  // adds `.visible`, so an element the snapshot missed stays invisible for as
  // long as the page is open. Verified on the Research Desk: header into the
  // DOM 2.5s after the click, `observe()` never called on it, computed opacity
  // 0. It read as text that loads only sometimes, "sometimes" being whether
  // you arrived by a fresh load or by a link.
  //
  // Keeping the registration live rather than one-shot fixes it wherever it
  // happens, and re-observing an element is a no-op, so overlap is harmless.
  const groups: [string, IntersectionObserver][] = [
    [REVEAL, observer],
    ['.system-card__bar-fill, .perf-winbar__fill, .perf-ratio__seg', barObserver],
    ['[data-count]', counterObserver],
  ]

  const late = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        // A page arriving by client navigation: whatever lands on screen is
        // shown before the browser paints (mutation callbacks run first), so
        // it never flashes empty while the observer catches up.
        revealInView(node)
        for (const [selector, io] of groups) {
          if (node.matches(selector)) io.observe(node)
          node.querySelectorAll(selector).forEach(el => io.observe(el))
        }
      }
    }
  })
  late.observe(document.body, { childList: true, subtree: true })

  return () => {
    late.disconnect()
    observer.disconnect()
    barObserver.disconnect()
    counterObserver.disconnect()
  }
}

export default function ClientScripts() {
  const pathname = usePathname()

  // Re-run animations when content is saved by the admin editor
  useEffect(() => {
    window.addEventListener('reinit-animations', init)
    return () => window.removeEventListener('reinit-animations', init)
  }, [])

  // Run animations on page load / navigation
  useEffect(() => {
    const cleanup = init()

    // Smooth anchor scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const targetId = (anchor as HTMLAnchorElement).getAttribute('href')
        if (!targetId || targetId === '#') return
        const target = document.querySelector(targetId)
        if (target) {
          e.preventDefault()
          const top = target.getBoundingClientRect().top + window.pageYOffset - 80
          window.scrollTo({ top, behavior: 'smooth' })
        }
      })
    })

    return cleanup
  }, [pathname])

  return null
}
