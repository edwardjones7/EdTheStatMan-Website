'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import NavAuth from './NavAuth'
import { IconUser, IconSettings, IconBolt } from './Icons'
import type { Membership } from '@/lib/access'
import type { SubscriptionTier } from '@/lib/supabase/types'
import { DESK_SPORTS } from '@/lib/desk'

interface NavClientProps {
  membership: Membership
  user: {
    email: string
    full_name: string | null
    subscription_tier: SubscriptionTier
    is_admin: boolean
  } | null
}

// Four products, not eight links. The bar was full; Contact moved to the
// footer and the two EdTheStatBot entries collapsed into The Portfolio.
const NAV_LINKS = [
  { href: '/portfolio', label: 'The Portfolio' },
  // Straight to the board rather than to /desk, which is only a server
  // redirect. That hop is a round trip the router cannot cover: it holds the
  // old page up until the redirect resolves, and the skeleton in
  // app/desk/[sport]/loading.tsx cannot appear until it has committed to the
  // [sport] segment. Measured at ~480ms of a click with no visible answer,
  // which reads as a missed click. `match` keeps the tab lit on every board,
  // /desk/cfb included, now that href names one of them.
  { href: `/desk/${DESK_SPORTS[0]}`, match: '/desk', label: 'Research Desk' },
  { href: '/vault', label: 'The Vault' },
  { href: '/blog', label: 'Blog' },
  { href: '/win', label: 'Membership', offer: true },
]

/**
 * Offer button for people who can still buy. Logged-out visitors are excluded on
 * purpose: NavAuth already renders "Sign Up", and two side-by-side primary CTAs
 * pointing at the same funnel just crowded the bar.
 */
function primaryCta(
  membership: Membership,
  tier: SubscriptionTier | null
): { href: string; label: string } | null {
  switch (membership) {
    case 'free':    return { href: '/win', label: 'Unlock All' }
    case 'expired': return { href: '/win', label: 'Renew' }
    // Every rung below the top can still climb.
    case 'active':  return tier === 'institutional' ? null : { href: '/win', label: 'Upgrade' }
    default:        return null
  }
}

export default function NavClient({ user, membership = 'logged-out' }: NavClientProps) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const router = useRouter()
  // The navigation is driven here rather than left to Link so it can be held
  // for two frames (see onNavClick). Still a transition, for the reason Link
  // makes it one: the current page stays on screen while the next one is
  // fetched, instead of being torn down for a boundary the moment it is asked
  // for. isPending is deliberately unused -- it resolves around 500ms in, while
  // the old page is still the only thing rendered.
  const [, startTransition] = useTransition()
  /** href of the link clicked but not yet arrived at. */
  const [pending, setPending] = useState<string | null>(null)
  // A navigation React abandons signals nothing, ever, and a bar left sweeping
  // for the rest of the session is a worse lie than no bar at all.
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null)
  const watcher = useRef<MutationObserver | null>(null)

  const stopNavigating = useCallback(() => {
    if (failsafe.current) {
      clearTimeout(failsafe.current)
      failsafe.current = null
    }
    watcher.current?.disconnect()
    watcher.current = null
    delete document.documentElement.dataset.navigating
    setPending(null)
  }, [])

  useEffect(() => stopNavigating, [stopNavigating])

  useEffect(() => {
    const handler = () => setScrolled(window.pageYOffset > 50)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
  }, [mobileOpen])

  // Escape closes the menu — the panel is opaque and full-screen, so there's no
  // backdrop to tap past it.
  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
    document.body.style.overflow = ''
  }, [pathname])

  const cta = primaryCta(membership, user?.subscription_tier ?? null)
  const compactX = membership !== 'active' && membership !== 'admin'

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  /**
   * Answer the click on the client, at once.
   *
   * loading.tsx cannot do this job. The router only mounts a loading boundary
   * once it has committed to the new segment, and it will not commit until the
   * server has answered -- so on a production build of this site, clicking
   * Research Desk left the previous page fully up, unchanged, for ~1.0s, and
   * when the route had already been prefetched the skeleton never appeared at
   * all: the board simply replaced the old page a second later. The Desk is the
   * slowest thing here (force-dynamic, four round trips, a whole season of
   * games) so it is the one people click twice, having read the silence as a
   * click that missed.
   *
   * Plain left clicks only. A modified click opens a new tab and this page is
   * staying exactly where it is, so it must not claim to be going anywhere.
   */
  const onNavClick = (e: React.MouseEvent, href: string) => {
    if (e.defaultPrevented || e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    if (href === pathname) return
    e.preventDefault()

    // Written straight to the DOM rather than held in state, because a state
    // update cannot answer this click promptly: React is precisely what is
    // busy. Measured on a production build, the class driven by `pending`
    // reached the DOM 576ms after the click, the router having held the main
    // thread in between. The bar is static markup that only CSS reads, so this
    // needs no render at all and lands in the next frame -- 1ms, measured.
    stopNavigating()
    document.documentElement.dataset.navigating = ''

    // Stop when the page is actually on screen, which nothing React exposes
    // will tell us: usePathname flips ~215ms in and the transition resolves
    // ~500ms in, both while the previous page is still the only thing rendered,
    // so ending on either leaves most of the wait uncovered. The page is a
    // direct child of <body>, so that child swapping IS the arrival -- and it
    // fires for the Desk's skeleton too, which is exactly the right moment to
    // hand over, since from there the skeleton is the loading state.
    watcher.current = new MutationObserver(stopNavigating)
    watcher.current.observe(document.body, { childList: true })
    failsafe.current = setTimeout(stopNavigating, 15000)

    setPending(href)

    // Two frames of deliberate delay before the navigation starts. Starting it
    // here in the handler pins the main thread for ~400ms rendering the
    // transition, and the browser cannot paint until that finishes -- so the
    // indicator meant to answer the click landed 400ms after it, which is the
    // problem this is here to solve. Two frames because a rAF callback runs
    // *before* its own frame's paint: the first only gets us to the frame
    // carrying the bar, the second to after it is on screen.
    //
    // The timer is not belt-and-braces, it is the whole safety net: rAF does
    // not fire at all in a background tab, so on rAF alone a click followed by
    // a tab switch would simply never navigate. Whichever fires first wins.
    let started = false
    const go = () => {
      if (started) return
      started = true
      startTransition(() => router.push(href))
    }
    requestAnimationFrame(() => requestAnimationFrame(go))
    setTimeout(go, 120)
  }

  return (
    <>
      <nav
        className={`nav ${scrolled ? 'scrolled' : ''}`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="nav__inner">
          <Link href="/" className="nav__logo">
            <div className="nav__logo-icon"><Image src="/logo.png" alt="EdTheStatMan logo" width={36} height={36} /></div>
            <span>EdTheStatMan</span>
          </Link>

          <div className="nav__links">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                onClick={e => onNavClick(e, link.href)}
                className={`nav__link${link.offer ? ' nav__link--offer' : ''}${
                  pending === link.href ? ' is-pending' : ''
                } ${isActive(link.match ?? link.href) ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="nav__actions">
            {compactX ? (
              <>
                <a
                  href="https://x.com/EdTheStatMan"
                  className="nav__cta nav__cta--icon"
                  target="_blank"
                  rel="noopener"
                  aria-label="Follow on X"
                  title="Follow on X"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                {cta && <Link href={cta.href} className="nav__cta">{cta.label}</Link>}
              </>
            ) : (
              <a href="https://x.com/EdTheStatMan" className="nav__cta" target="_blank" rel="noopener">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '6px' }}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Follow on X
              </a>
            )}
            <NavAuth user={user} membership={membership} />
          </div>

          <button
            className={`nav__hamburger ${mobileOpen ? 'active' : ''}`}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen(o => !o)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>

        {/* Sits on the nav's bottom border, so it reads as the page loading
            rather than as something happening to the bar. Indeterminate: a
            database round trip has no progress to report. */}
        <span className="nav__progress" aria-hidden="true">
          <span className="nav__progress-fill" />
        </span>
        <span className="sr-only" role="status">
          {pending ? 'Loading page' : ''}
        </span>
      </nav>

      <div id="mobile-menu" className={`mobile-menu ${mobileOpen ? 'active' : ''}`}>
        <div className="mobile-menu__links">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={e => onNavClick(e, link.href)}
              className={`mobile-menu__link${pending === link.href ? ' is-pending' : ''} ${
                isActive(link.match ?? link.href) ? 'active' : ''
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mobile-menu__footer">
          {!user ? (
            <div className="mobile-menu__auth">
              <Link href="/login" className="btn btn--outline btn--sm">Sign In</Link>
              <Link href="/signup" className="btn btn--primary btn--sm">Sign Up</Link>
            </div>
          ) : (
            <div className="mobile-menu__user-info">
              <div className="mobile-menu__user-email">{user.email}</div>
              <div className="mobile-menu__user-links">
                <Link href="/account" className="mobile-menu__user-link"><IconUser size={14} /> My Account</Link>
                {user.is_admin && (
                  <Link href="/admin" className="mobile-menu__user-link"><IconSettings size={14} /> Admin Dashboard</Link>
                )}
              </div>
            </div>
          )}
          {cta && (
            <Link href={cta.href} className="mobile-menu__cta">
              <IconBolt size={14} /> {cta.label}
            </Link>
          )}
          <a
            href="https://x.com/EdTheStatMan"
            className={`mobile-menu__cta${cta ? ' mobile-menu__cta--ghost' : ''}`}
            target="_blank"
            rel="noopener"
          >
            Follow on X
          </a>
        </div>
      </div>
    </>
  )
}
