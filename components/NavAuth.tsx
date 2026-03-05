'use client'

import { useState } from 'react'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import type { SubscriptionTier } from '@/lib/supabase/types'

interface NavAuthProps {
  user: {
    email: string
    full_name: string | null
    subscription_tier: SubscriptionTier
    is_admin: boolean
  } | null
}

export default function NavAuth({ user }: NavAuthProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  if (!user) {
    return (
      <div className="nav__auth-actions">
        <Link href="/login" className="btn btn--outline btn--sm">Sign In</Link>
        <Link href="/signup" className="btn btn--primary btn--sm">Get Started</Link>
      </div>
    )
  }

  const tierLabel = user.is_admin
    ? 'Admin'
    : user.subscription_tier === 'premium'
    ? 'Premium'
    : user.subscription_tier === 'basic'
    ? 'Basic'
    : 'Free'

  const initial = (user.full_name ?? user.email).charAt(0).toUpperCase()

  return (
    <div className="nav__user" onMouseLeave={() => setMenuOpen(false)}>
      <button
        className="nav__user-btn"
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Account menu"
      >
        <div className="nav__user-avatar">{initial}</div>
        <span className={`nav__user-tier nav__user-tier--${user.is_admin ? 'admin' : user.subscription_tier}`}>{tierLabel}</span>
      </button>

      {menuOpen && (
        <div className="nav__user-menu">
          <div className="nav__user-menu-header">
            <div className="nav__user-menu-name">{user.full_name ?? user.email}</div>
            <div className="nav__user-menu-email">{user.email}</div>
          </div>
          <div className="nav__user-menu-items">
            <Link href="/account" className="nav__user-menu-item" onClick={() => setMenuOpen(false)}>
              &#128100; My Account
            </Link>
            {user.subscription_tier === 'free' && (
              <Link href="/betting-systems#pricing" className="nav__user-menu-item nav__user-menu-item--upgrade" onClick={() => setMenuOpen(false)}>
                &#9889; Upgrade Plan
              </Link>
            )}
            {user.is_admin && (
              <Link href="/admin" className="nav__user-menu-item" onClick={() => setMenuOpen(false)}>
                &#9881; Admin Dashboard
              </Link>
            )}
            <form action={logout}>
              <button type="submit" className="nav__user-menu-item nav__user-menu-item--logout">
                &#8594; Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
