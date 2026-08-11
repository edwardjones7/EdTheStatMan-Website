'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import { IconUser, IconSettings, IconBolt } from './Icons'
import type { SubscriptionTier } from '@/lib/supabase/types'
import type { Membership } from '@/lib/access'

interface NavAuthProps {
  user: {
    email: string
    full_name: string | null
    subscription_tier: SubscriptionTier
    is_admin: boolean
  } | null
  membership?: Membership
}

export default function NavAuth({ user, membership = 'logged-out' }: NavAuthProps) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isOpen = hovered || pinned

  // Clean up hover timer on unmount
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current) }, [])

  // Click outside closes the pinned state
  useEffect(() => {
    if (!pinned) return
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPinned(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [pinned])

  function close() {
    setPinned(false)
    setHovered(false)
  }

  if (!user) {
    return (
      <div className="nav__auth-actions">
        <Link href="/login" className="btn btn--outline btn--sm">Sign In</Link>
        <Link href="/signup" className="btn btn--primary btn--sm">Sign Up</Link>
      </div>
    )
  }

  const activeLabel =
    user.subscription_tier === 'elite' ? 'Elite' :
    user.subscription_tier === 'premium' ? 'Premium' :
    'Basic'
  const tierLabel =
    membership === 'admin'   ? 'Admin' :
    membership === 'expired' ? 'Expired' :
    membership === 'active'  ? activeLabel :
    'Free'

  const tierModifier =
    membership === 'admin'   ? 'admin' :
    membership === 'expired' ? 'expired' :
    membership === 'active'  ? user.subscription_tier :
    'free'

  const initial = (user.full_name ?? user.email).charAt(0).toUpperCase()

  return (
    <div
      ref={containerRef}
      className="nav__user"
      onMouseEnter={() => {
        if (closeTimer.current) clearTimeout(closeTimer.current)
        setHovered(true)
      }}
      onMouseLeave={() => {
        closeTimer.current = setTimeout(() => setHovered(false), 200)
      }}
    >
      <button
        className="nav__user-btn"
        onClick={() => setPinned(p => !p)}
        aria-label="Account menu"
        aria-expanded={isOpen}
      >
        <div className="nav__user-avatar">{initial}</div>
        <span className={`nav__user-tier nav__user-tier--${tierModifier}`}>{tierLabel}</span>
      </button>

      {isOpen && (
        <div className="nav__user-menu">
          <div className="nav__user-menu-header">
            <div className="nav__user-menu-name">{user.full_name ?? user.email}</div>
            <div className="nav__user-menu-email">{user.email}</div>
          </div>
          <div className="nav__user-menu-items">
            <Link href="/account" className="nav__user-menu-item" onClick={close}>
              <IconUser size={14} /> My Account
            </Link>
            {(membership === 'free' || membership === 'expired') && (
              <Link href="/win" className="nav__user-menu-item nav__user-menu-item--upgrade" onClick={close}>
                <IconBolt size={14} /> {membership === 'expired' ? 'Renew Access' : 'Upgrade Plan'}
              </Link>
            )}
            {user.is_admin && (
              <Link href="/admin" className="nav__user-menu-item" onClick={close}>
                <IconSettings size={14} /> Admin Dashboard
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
