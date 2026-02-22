'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import MobileMenu from './MobileMenu'

export default function Navigation() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.pageYOffset > 50)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : ''
  }, [mobileMenuOpen])

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  return (
    <>
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="nav__inner">
          <Link href="/" className="nav__logo">
            <div className="nav__logo-icon">E</div>
            <span>EdTheStatMan</span>
          </Link>

          <div className="nav__links">
            <Link href="/" className={`nav__link ${isActive('/') ? 'active' : ''}`}>
              Today&apos;s Action
            </Link>
            <Link href="/betting-systems" className={`nav__link ${isActive('/betting-systems') ? 'active' : ''}`}>
              Betting Systems
            </Link>
            <Link href="/betting-trends" className={`nav__link ${isActive('/betting-trends') ? 'active' : ''}`}>
              Betting Trends
            </Link>
            <Link href="/blog" className={`nav__link ${isActive('/blog') ? 'active' : ''}`}>
              Blog
            </Link>
            <Link href="/results" className={`nav__link ${isActive('/results') ? 'active' : ''}`}>
              Results
            </Link>
            <Link href="/contact" className={`nav__link ${isActive('/contact') ? 'active' : ''}`}>
              Contact
            </Link>
          </div>

          <div className="nav__actions">
            <a href="https://t.me/edthestatman" className="nav__cta" target="_blank" rel="noopener">
              <span className="btn__icon">&#9889;</span> Join Telegram
            </a>
          </div>

          <button 
            className={`nav__hamburger ${mobileMenuOpen ? 'active' : ''}`}
            aria-label="Toggle menu"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>
      <MobileMenu isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </>
  )
}
