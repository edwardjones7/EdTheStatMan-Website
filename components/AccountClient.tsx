'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { logout } from '@/app/actions/auth'
import { updateProfile, updatePassword, updateNotifyEmail } from '@/app/account/actions'
import PushOptIn from './PushOptIn'
import { IconUser, IconLock, IconBolt, IconBell, IconChat } from './Icons'
import type { SubscriptionTier } from '@/lib/supabase/types'
import { normalizeTier, TIER_SHORT_LABEL } from '@/lib/access'

interface AccountClientProps {
  profile: {
    email: string
    full_name: string | null
    subscription_tier: SubscriptionTier
    access_expires_at: string | null
    is_admin: boolean
    created_at: string
    stripe_customer_id: string | null
    stripe_subscription_id: string | null
    notify_email: boolean
  }
  provider: string
  /** Whether this member has already linked a Discord account. */
  discordLinked?: boolean
}

// Labels come from TIER_SHORT_LABEL in lib/access.ts -- tier copy used to be
// duplicated across four files and drifted. Only the descriptions live here.
const TIER_DESCRIPTION: Record<SubscriptionTier, string> = {
  retail: 'A curated set of free systems, trends and picks. Records visible on everything else.',
  portfolio: 'Every pick, unlocked, with the full line and unit sizing.',
  desk: 'The season schedule with curated trends attached to every matchup, plus everything in The Portfolio.',
  private: 'The complete systems and trends libraries, filterable, plus everything in The Research Desk.',
  institutional: 'Raw row export, query builder, API key and backtester on top of everything in Private Intelligence.',
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

type Msg = { type: 'success' | 'error'; text: string }

export default function AccountClient({ profile, provider, discordLinked = false }: AccountClientProps) {
  const searchParams = useSearchParams()
  const subscribeSuccess = searchParams.get('success') === '1'
  const [isPending, startTransition] = useTransition()
  const [profileMsg, setProfileMsg] = useState<Msg | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<Msg | null>(null)
  const [displayName, setDisplayName] = useState(profile.full_name ?? '')
  const [notifyEmail, setNotifyEmail] = useState(profile.notify_email)
  const [notifyMsg, setNotifyMsg] = useState<Msg | null>(null)
  const [billingBusy, setBillingBusy] = useState(false)
  const [billingMsg, setBillingMsg] = useState<Msg | null>(null)

  const hasSubscription = !!profile.stripe_subscription_id
  // The portal carries receipts and card details as well as cancellation, so a
  // one-time buyer gets it too -- they simply see no subscription to cancel.
  const canManageBilling = !!profile.stripe_customer_id && !profile.is_admin

  async function openBillingPortal() {
    setBillingBusy(true)
    setBillingMsg(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not open the billing portal.')
      window.location.href = data.url
    } catch (e: any) {
      setBillingMsg({ type: 'error', text: e?.message ?? 'Could not open the billing portal.' })
      setBillingBusy(false)
    }
  }

  const normalized = normalizeTier(profile.subscription_tier)
  const tierConfig = {
    label: TIER_SHORT_LABEL[normalized],
    description: TIER_DESCRIPTION[normalized],
  }
  const tierLabel = profile.is_admin ? 'Admin' : tierConfig.label
  const planKey = profile.is_admin ? 'admin' : profile.subscription_tier
  const initial = (profile.full_name ?? profile.email).charAt(0).toUpperCase()

  const avatarClass = profile.is_admin
    ? 'account-hero__avatar account-hero__avatar--admin'
    : normalized === 'institutional' || normalized === 'private'
    ? 'account-hero__avatar account-hero__avatar--elite'
    : normalized === 'desk'
    ? 'account-hero__avatar account-hero__avatar--premium'
    : 'account-hero__avatar'

  const expiresAt = profile.access_expires_at ? new Date(profile.access_expires_at) : null
  const isActive = !!expiresAt && expiresAt > new Date()
  const isExpired = !!expiresAt && expiresAt <= new Date()

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

  function handleNotifyToggle(next: boolean) {
    // Optimistic: the checkbox tracks intent immediately and rolls back on error.
    setNotifyEmail(next)
    setNotifyMsg(null)
    startTransition(async () => {
      const result = await updateNotifyEmail(next)
      if (result.error) {
        setNotifyEmail(!next)
        setNotifyMsg({ type: 'error', text: result.error })
      } else {
        setNotifyMsg({ type: 'success', text: next ? 'Email alerts on.' : 'Email alerts off.' })
      }
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

        {subscribeSuccess && (
          <div className="account-success-banner">
            &#10003; Payment successful! Welcome to {tierConfig.label} access.
          </div>
        )}

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
            {normalized !== 'retail' && !profile.is_admin && expiresAt && (
              <span className={`account-plan__status ${isExpired ? 'account-plan__status--warn' : 'account-plan__status--active'}`}>
                {isExpired ? 'Expired' : `Access until ${formatDate(expiresAt.toISOString())}`}
              </span>
            )}
            {hasSubscription && !profile.is_admin && (
              <p className="account-field-hint">
                Cancel anytime in the billing portal. Access runs to the end of the period you have paid for.
              </p>
            )}
          </div>

          {!profile.is_admin && (
            <div className="account-plan__actions">
              {(normalized === 'retail' || isExpired) ? (
                <Link href="/win" className="btn btn--primary btn--sm">
                  <IconBolt size={14} /> {isExpired ? 'Renew Access' : 'Upgrade Plan'}
                </Link>
              ) : null}
              {canManageBilling && (
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={openBillingPortal}
                  disabled={billingBusy}
                >
                  {billingBusy
                    ? 'Opening…'
                    : hasSubscription ? 'Manage Subscription' : 'Billing & Receipts'}
                </button>
              )}
              {billingMsg && (
                <p className="account-field-hint" style={{ textAlign: 'right', maxWidth: '220px' }}>
                  {billingMsg.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Forms */}
        <div className={`account-forms-grid${provider !== 'email' ? ' account-forms-grid--single' : ''}`}>

          {/* Profile */}
          <div className="account-card">
            <div className="account-card__header">
              <div className="account-card__icon"><IconUser size={18} /></div>
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
                <div className="account-card__icon"><IconLock size={18} /></div>
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

          {/* Pick alerts */}
          <div className="account-card">
            <div className="account-card__header">
              <div className="account-card__icon"><IconBell size={18} /></div>
              <h2 className="account-card__title">Pick Alerts</h2>
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={notifyEmail}
                  onChange={(e) => handleNotifyToggle(e.target.checked)}
                  disabled={isPending}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  Email me when a new pick drops
                  <span className="account-field-hint" style={{ display: 'block' }}>
                    You&apos;ll only be emailed about picks your membership can open.
                  </span>
                </span>
              </label>
            </div>
            <div className="form-group">
              <span className="account-field-hint" style={{ display: 'block', marginBottom: '8px' }}>
                Browser notifications on this device:
              </span>
              <PushOptIn />
            </div>
            {notifyMsg && (
              <div className={notifyMsg.type === 'error' ? 'auth-error' : 'auth-success'}>
                {notifyMsg.text}
              </div>
            )}
          </div>
        </div>

        {/* Discord — link once, then the role tracks the membership. */}
        <div className="account-card">
          <div className="account-card__header">
            <div className="account-card__icon"><IconChat size={18} /></div>
            <h2 className="account-card__title">Discord</h2>
          </div>
          <div className="form-group">
            <span className="account-field-hint" style={{ display: 'block', marginBottom: '12px' }}>
              {discordLinked
                ? 'Connected. The Members role is granted while your access is active, and removed when it lapses.'
                : 'Connect your Discord account to get the Members role automatically for as long as your access is active.'}
            </span>
            <a
              className={`btn btn--sm ${discordLinked ? 'btn--outline' : 'btn--primary'}`}
              href="/api/discord/connect"
            >
              {discordLinked ? 'Reconnect Discord' : 'Connect Discord'}
            </a>
          </div>
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
