'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import NavAuth from './NavAuth'
import { IconUser, IconSettings, IconBolt } from './Icons'
import type { Membership } from '@/lib/access'
import type { SubscriptionTier } from '@/lib/supabase/types'

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
  { href: '/desk', label: 'Research Desk' },
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

  return (
    <>
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`} role="navigation" aria-label="Main navigation">
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
                className={`nav__link${link.offer ? ' nav__link--offer' : ''} ${isActive(link.href) ? 'active' : ''}`}
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
      </nav>

      <div id="mobile-menu" className={`mobile-menu ${mobileOpen ? 'active' : ''}`}>
        <div className="mobile-menu__links">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`mobile-menu__link ${isActive(link.href) ? 'active' : ''}`}
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
