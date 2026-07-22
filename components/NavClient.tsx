'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import NavAuth from './NavAuth'
import { IconUser, IconSettings, IconBolt } from './Icons'
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
            <div className="nav__logo-icon"><Image src="/logo.png" alt="EdTheStatMan logo" width={36} height={36} /></div>
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
            <a href="https://x.com/EdTheStatMan" className="nav__cta" target="_blank" rel="noopener">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '6px' }}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              Follow on X
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
                <Link href="/account" className="mobile-menu__user-link"><IconUser size={14} /> My Account</Link>
                {user.is_admin && (
                  <Link href="/admin" className="mobile-menu__user-link"><IconSettings size={14} /> Admin Dashboard</Link>
                )}
              </div>
            </div>
          )}
          <a href="https://x.com/EdTheStatMan" className="mobile-menu__cta" target="_blank" rel="noopener">
            <IconBolt size={14} /> Follow on X
          </a>
        </div>
      </div>
    </>
  )
}
