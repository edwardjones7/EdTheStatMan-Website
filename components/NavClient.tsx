'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import NavAuth from './NavAuth'
import type { SubscriptionTier } from '@/lib/supabase/types'

interface NavClientProps {
  user: {
    email: string
    full_name: string | null
    subscription_tier: SubscriptionTier
    is_admin: boolean
  } | null
}

const NAV_LINKS = [
  { href: '/model-picks', label: 'Model Picks' },
  { href: '/results', label: 'Model Results' },
  { href: '/betting-systems', label: 'Betting Systems' },
  { href: '/betting-trends', label: 'Betting Trends' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
]

export default function NavClient({ user }: NavClientProps) {
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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false)
    document.body.style.overflow = ''
  }, [pathname])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="nav__inner">
          <Link href="/" className="nav__logo">
            <div className="nav__logo-icon"><svg viewBox="0 0 32 32" width="100%" height="100%"><defs><linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#34d399"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs><rect width="32" height="32" rx="4" fill="#0f172a"/><path d="M7 5 L25 5 L23 9 L11 9 L11 14 L22 14 L20.5 18 L11 18 L11 23 L25 23 L23 27 L7 27 Z" fill="url(#logo-g)"/></svg></div>
            <span>EdTheStatMan</span>
          </Link>

          <div className="nav__links">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav__link ${isActive(link.href) ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="nav__actions">
            <a href="https://t.me/edthestatman" className="nav__cta" target="_blank" rel="noopener">
              <span className="btn__icon">&#9889;</span> Join Telegram
            </a>
            <NavAuth user={user} />
          </div>

          <button
            className={`nav__hamburger ${mobileOpen ? 'active' : ''}`}
            aria-label="Toggle menu"
            onClick={() => setMobileOpen(o => !o)}
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </nav>

      <div className={`mobile-menu ${mobileOpen ? 'active' : ''}`}>
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
                <Link href="/account" className="mobile-menu__user-link">&#128100; My Account</Link>
                {user.is_admin && (
                  <Link href="/admin" className="mobile-menu__user-link">&#9881; Admin Dashboard</Link>
                )}
              </div>
            </div>
          )}
          <a href="https://t.me/edthestatman" className="mobile-menu__cta" target="_blank" rel="noopener">
            &#9889; Join Telegram
          </a>
        </div>
      </div>
    </>
  )
}
