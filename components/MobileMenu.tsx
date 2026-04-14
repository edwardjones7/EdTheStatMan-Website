'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
}

export default function MobileMenu({ isOpen, onClose }: MobileMenuProps) {
  const pathname = usePathname()

  const isActive = (path: string) => {
    if (path === '/') return pathname === '/'
    return pathname.startsWith(path)
  }

  return (
    <div className={`mobile-menu ${isOpen ? 'active' : ''}`}>
      <Link href="/model-picks" className={`mobile-menu__link ${isActive('/model-picks') ? 'active' : ''}`} onClick={onClose}>
        Model Picks
      </Link>
      <Link href="/betting-systems" className={`mobile-menu__link ${isActive('/betting-systems') ? 'active' : ''}`} onClick={onClose}>
        Betting Systems
      </Link>
      <Link href="/betting-trends" className={`mobile-menu__link ${isActive('/betting-trends') ? 'active' : ''}`} onClick={onClose}>
        Betting Trends
      </Link>
      <Link href="/blog" className={`mobile-menu__link ${isActive('/blog') ? 'active' : ''}`} onClick={onClose}>
        Blog
      </Link>
      <Link href="/results" className={`mobile-menu__link ${isActive('/results') ? 'active' : ''}`} onClick={onClose}>
        Results
      </Link>
      <Link href="/contact" className={`mobile-menu__link ${isActive('/contact') ? 'active' : ''}`} onClick={onClose}>
        Contact
      </Link>
      <a href="https://x.com/EdTheStatMan" className="mobile-menu__cta" target="_blank" rel="noopener" onClick={onClose}>
        &#9889; Follow on X
      </a>
    </div>
  )
}
