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
  { href: '/', label: "Today's Action" },
  { href: '/betting-systems', label: 'Betting Systems' },
  { href: '/betting-trends', label: 'Betting Trends' },
  { href: '/blog', label: 'Blog' },
  { href: '/results', label: 'Results' },
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
            <div className="nav__logo-icon">E</div>
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
        {NAV_LINKS.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`mobile-menu__link ${isActive(link.href) ? 'active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
        <a href="https://t.me/edthestatman" className="mobile-menu__cta" target="_blank" rel="noopener">
          &#9889; Join Telegram
        </a>
        {!user ? (
          <div style={{ display: 'flex', gap: '12px', padding: '16px 24px 0' }}>
            <Link href="/login" className="btn btn--outline btn--sm" style={{ flex: 1, justifyContent: 'center' }}>Sign In</Link>
            <Link href="/signup" className="btn btn--primary btn--sm" style={{ flex: 1, justifyContent: 'center' }}>Get Started</Link>
          </div>
        ) : (
          <div style={{ padding: '16px 24px 0', borderTop: '1px solid var(--border-color)', marginTop: '8px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>{user.email}</p>
            <Link href="/account" className="mobile-menu__link">&#128100; My Account</Link>
            {user.is_admin && (
              <Link href="/admin" className="mobile-menu__link">&#9881; Admin Dashboard</Link>
            )}
          </div>
        )}
      </div>
    </>
  )
}
