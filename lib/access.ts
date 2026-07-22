// Single source of truth for "what can this person see?".
//
// Access is decided by `access_expires_at` alone. `subscription_status` is
// deliberately NOT read: the Stripe webhook sets it to 'active' on purchase and
// never clears it, so anything gating on it treats expired users as paid.
//
// Pure module — no server imports — so client components can use it too.

export type SubscriptionTier = 'free' | 'basic' | 'premium'

/** Coarser than tier: distinguishes a never-paid user from a lapsed one. */
export type Membership = 'logged-out' | 'free' | 'expired' | 'active' | 'admin'

/** Column list for `profiles` selects that feed resolveAccess(). */
export const ACCESS_SELECT = 'subscription_tier, access_expires_at, is_admin'

export interface AccessProfile {
  subscription_tier?: string | null
  access_expires_at?: string | null
  is_admin?: boolean | null
}

export interface Access {
  /**
   * null = logged out, 'free' = logged in without valid paid access.
   * Expired paid users collapse to 'free' — several client components branch on
   * `userTier === null` to mean "logged out", so this shape must not change.
   */
  tier: SubscriptionTier | null
  isAdmin: boolean
  isPaid: boolean
  membership: Membership
  expiresAt: Date | null
}

export function resolveAccess(
  profile: AccessProfile | null | undefined,
  isLoggedIn: boolean
): Access {
  if (!isLoggedIn) {
    return { tier: null, isAdmin: false, isPaid: false, membership: 'logged-out', expiresAt: null }
  }

  if (profile?.is_admin) {
    return { tier: 'premium', isAdmin: true, isPaid: true, membership: 'admin', expiresAt: null }
  }

  const storedTier = (profile?.subscription_tier ?? 'free') as SubscriptionTier
  const expiresAt = profile?.access_expires_at ? new Date(profile.access_expires_at) : null

  if (storedTier === 'free') {
    return { tier: 'free', isAdmin: false, isPaid: false, membership: 'free', expiresAt: null }
  }

  // A paid tier with a missing or past expiry has lapsed.
  const stillValid = !!expiresAt && expiresAt.getTime() > Date.now()
  if (!stillValid) {
    return { tier: 'free', isAdmin: false, isPaid: false, membership: 'expired', expiresAt }
  }

  return { tier: storedTier, isAdmin: false, isPaid: true, membership: 'active', expiresAt }
}
