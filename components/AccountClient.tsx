'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import { updateProfile, updatePassword } from '@/app/account/actions'
import type { SubscriptionTier, SubscriptionStatus } from '@/lib/supabase/types'

interface AccountClientProps {
  profile: {
    email: string
    full_name: string | null
    subscription_tier: SubscriptionTier
    subscription_status: SubscriptionStatus | null
    is_admin: boolean
    created_at: string
    stripe_customer_id: string | null
  }
  provider: string
}

const TIER_CONFIG: Record<SubscriptionTier, { label: string; description: string }> = {
  free:    { label: 'Free',    description: 'Access to a curated set of free betting systems and trends.' },
  basic:   { label: 'Basic',   description: 'Full access to all betting systems, trends, and blog posts.' },
  premium: { label: 'Premium', description: 'Full access to all content plus EdTheStatBot (coming soon).' },
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

type Msg = { type: 'success' | 'error'; text: string }

export default function AccountClient({ profile, provider }: AccountClientProps) {
  const [isPending, startTransition] = useTransition()
  const [profileMsg, setProfileMsg] = useState<Msg | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<Msg | null>(null)
  const [displayName, setDisplayName] = useState(profile.full_name ?? '')

  const tierConfig = TIER_CONFIG[profile.subscription_tier]
  const tierLabel = profile.is_admin ? 'Admin' : tierConfig.label
  const planKey = profile.is_admin ? 'admin' : profile.subscription_tier
  const initial = (profile.full_name ?? profile.email).charAt(0).toUpperCase()

  const avatarClass = profile.is_admin
    ? 'account-hero__avatar account-hero__avatar--admin'
    : profile.subscription_tier === 'premium'
    ? 'account-hero__avatar account-hero__avatar--premium'
    : 'account-hero__avatar'

  const isSubscribed = profile.subscription_status === 'active' || profile.subscription_status === 'trialing'
  const hasIssue = profile.subscription_status && !isSubscribed

  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileMsg(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await updateProfile(formData)
      setProfileMsg(result.error
        ? { type: 'error', text: result.error }
        : { type: 'success', text: 'Profile updated.' }
      )
    })
  }

  function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPasswordMsg(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    startTransition(async () => {
      const result = await updatePassword(formData)
      if (result.error) {
        setPasswordMsg({ type: 'error', text: result.error })
      } else {
        setPasswordMsg({ type: 'success', text: 'Password updated successfully.' })
        form.reset()
      }
    })
  }

  return (
    <main className="account-page">
      <div className="account-container">

        {/* Hero */}
        <div className="account-hero">
          <div className={avatarClass}>{initial}</div>
          <div className="account-hero__info">
            <h1 className="account-hero__name">{profile.full_name ?? profile.email}</h1>
            <p className="account-hero__email">{profile.email}</p>
            <div className="account-hero__meta">
              <span className={`nav__user-tier nav__user-tier--${planKey}`}>{tierLabel}</span>
              <span className="account-hero__dot" />
              <span className="account-hero__since">Member since {formatDate(profile.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Plan */}
        <div className={`account-plan-card account-plan-card--${planKey}`}>
          <div>
            <p className="account-plan__label">Your Plan</p>
            <h2 className="account-plan__name">{tierLabel}</h2>
            <p className="account-plan__desc">
              {profile.is_admin
                ? 'Full administrative access to all content and settings.'
                : tierConfig.description}
            </p>
            {profile.subscription_tier !== 'free' && !profile.is_admin && (
              <span className={`account-plan__status ${hasIssue ? 'account-plan__status--warn' : 'account-plan__status--active'}`}>
                {hasIssue
                  ? (profile.subscription_status ?? '').replace('_', ' ')
                  : 'Active'}
              </span>
            )}
          </div>

          {!profile.is_admin && (
            <div className="account-plan__actions">
              {profile.subscription_tier === 'free' ? (
                <Link href="/betting-systems#pricing" className="btn btn--primary btn--sm">
                  &#9889; Upgrade Plan
                </Link>
              ) : (
                <button className="btn btn--outline btn--sm" disabled title="Billing portal coming soon">
                  Manage Billing
                </button>
              )}
            </div>
          )}
        </div>

        {/* Forms */}
        <div className={`account-forms-grid${provider !== 'email' ? ' account-forms-grid--single' : ''}`}>

          {/* Profile */}
          <div className="account-card">
            <div className="account-card__header">
              <div className="account-card__icon">&#128100;</div>
              <h2 className="account-card__title">Profile</h2>
            </div>
            <form onSubmit={handleProfileSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  value={profile.email}
                  disabled
                />
                <p className="account-field-hint">Email cannot be changed.</p>
              </div>
              <div className="form-group">
                <label htmlFor="full_name">Display Name</label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  className="form-input"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>
              {profileMsg && (
                <div className={profileMsg.type === 'error' ? 'auth-error' : 'auth-success'} style={{ marginBottom: '16px' }}>
                  {profileMsg.text}
                </div>
              )}
              <button type="submit" className="btn btn--primary btn--sm" disabled={isPending} style={{ marginTop: '8px' }}>
                {isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Security — email/password users only */}
          {provider === 'email' && (
            <div className="account-card">
              <div className="account-card__header">
                <div className="account-card__icon">&#128274;</div>
                <h2 className="account-card__title">Security</h2>
              </div>
              <form onSubmit={handlePasswordSubmit}>
                <div className="form-group">
                  <label htmlFor="password">New Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    className="form-input"
                    placeholder="Min. 8 characters"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="confirm_password">Confirm Password</label>
                  <input
                    id="confirm_password"
                    name="confirm_password"
                    type="password"
                    className="form-input"
                    placeholder="Repeat new password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
                {passwordMsg && (
                  <div className={passwordMsg.type === 'error' ? 'auth-error' : 'auth-success'} style={{ marginBottom: '16px' }}>
                    {passwordMsg.text}
                  </div>
                )}
                <button type="submit" className="btn btn--outline btn--sm" disabled={isPending} style={{ marginTop: '8px' }}>
                  {isPending ? 'Updating…' : 'Change Password'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Sign Out */}
        <div className="account-signout">
          <form action={logout}>
            <button type="submit" className="btn btn--outline btn--sm">
              &#8594;&nbsp; Sign Out
            </button>
          </form>
        </div>

      </div>
    </main>
  )
}
