// Single source of truth for "what can this person see?".
//
// Access is decided by `access_expires_at` alone. `subscription_status` is
// deliberately NOT read: the Stripe webhook sets it to 'active' on purchase and
// never clears it, so anything gating on it treats expired users as paid.
//
// Pure module — no server imports — so client components can use it too.

/**
 * The v3 ladder. Each rung includes everything below it.
 *
 *   retail        Vault — Retail Intelligence      free
 *   portfolio     The Portfolio (picks)            $49 once / $199 season
 *   desk          The Research Desk                $129/mo  / $499 season
 *   private       Vault — Private Intelligence     $199/mo  / $799 season
 *   institutional Vault — Institutional            $399/mo  / $1,499 season
 */
export type Tier = 'retail' | 'portfolio' | 'desk' | 'private' | 'institutional'

/** Ordering for gates and for upgrade/anti-downgrade decisions. */
export const TIER_RANK: Record<Tier, number> = {
  retail: 0,
  portfolio: 1,
  desk: 2,
  private: 3,
  institutional: 4,
}

/** Full product names. The single source of tier copy for the whole app. */
export const TIER_LABEL: Record<Tier, string> = {
  retail: 'Vault — Retail Intelligence',
  portfolio: 'The Portfolio',
  desk: 'The Research Desk',
  private: 'Vault — Private Intelligence',
  institutional: 'Vault — Institutional Intelligence',
}

/** Short names for nav pills, badges and inline confirmations. */
export const TIER_SHORT_LABEL: Record<Tier, string> = {
  retail: 'Retail',
  portfolio: 'Portfolio',
  desk: 'Research Desk',
  private: 'Private',
  institutional: 'Institutional',
}

/** Ladder order, lowest first. Safe to iterate for UI. */
export const TIERS: Tier[] = ['retail', 'portfolio', 'desk', 'private', 'institutional']

/**
 * Pre-v3 tier values, mapped onto the ladder.
 *
 * The app must run correctly against BOTH the old and new column values so the
 * code deploy and the hand-applied SQL migration don't have to be simultaneous.
 * This is the same mapping the migration itself uses.
 */
const LEGACY_TIER: Record<string, Tier> = {
  free: 'retail',
  basic: 'desk',
  premium: 'private',
  elite: 'institutional',
}

/** Normalize any stored tier string (legacy or current) onto the ladder. */
export function normalizeTier(value: string | null | undefined): Tier {
  if (!value) return 'retail'
  if (value in TIER_RANK) return value as Tier
  return LEGACY_TIER[value] ?? 'retail'
}

/**
 * The ladder predicate — the one gate every check funnels through.
 * Standalone (not just a method on Access) so client components that only
 * receive a tier string can use it, the way isPaidTier() is used today.
 */
export function atLeastTier(tier: string | null | undefined, required: Tier): boolean {
  // Takes a raw string so client components -- which only ever receive
  // `userTier: string | null` as a prop -- can call it directly, and so a
  // legacy value still in the column resolves correctly.
  if (tier === null || tier === undefined) return false
  return TIER_RANK[normalizeTier(tier)] >= TIER_RANK[required]
}

/** True for any paid rung. Use instead of hand-written tier lists. */
export function isPaidTier(tier: string | null | undefined): boolean {
  if (tier === null || tier === undefined) return false
  return atLeastTier(normalizeTier(tier), 'portfolio')
}

/**
 * Every stored `subscription_tier` string that means "has paid" — the ladder
 * values AND the pre-v3 ones, because a query runs against whichever vocabulary
 * the column happens to hold at the time.
 *
 * For `.in('subscription_tier', ...)` filters, which need values rather than a
 * predicate. Derived from the ladder, so a new rung or a new legacy alias is
 * picked up without editing a list — a hand-written list here would have
 * reported zero paying users the moment the migration renamed the tiers.
 */
export const PAID_TIER_VALUES: string[] = [
  ...TIERS.filter(isPaidTier),
  ...Object.keys(LEGACY_TIER).filter(isPaidTier),
]

/** Coarser than tier: distinguishes a never-paid user from a lapsed one. */
export type Membership = 'logged-out' | 'free' | 'expired' | 'active' | 'admin'

/** Column list for `profiles` selects that feed resolveAccess(). */
export const ACCESS_SELECT = 'subscription_tier, access_expires_at, is_admin'

/**
 * Extra columns for surfaces that render BILLING state -- the account page, a
 * dunning banner, the Manage Billing button.
 *
 * Deliberately NOT folded into ACCESS_SELECT. Entitlement must stay a function
 * of access_expires_at alone, and lib/notify/audience.ts selects ACCESS_SELECT
 * across every profile row on the site.
 *
 * These columns only exist after tier_ladder_03_billing_slots.sql is applied;
 * getAccess({ billing: true }) falls back gracefully until then.
 */
export const BILLING_SELECT =
  'billing_mode, sub_tier, subscription_status, sub_current_period_end, ' +
  'sub_cancel_at_period_end, pass_tier, pass_expires_at, stripe_subscription_id'

/** How the current grant was paid for. Drives account copy and the portal button. */
export type BillingMode = 'none' | 'pass' | 'subscription' | 'both'

export interface AccessProfile {
  subscription_tier?: string | null
  access_expires_at?: string | null
  is_admin?: boolean | null
  // Present only when BILLING_SELECT was included in the select.
  billing_mode?: string | null
  subscription_status?: string | null
  sub_current_period_end?: string | null
  sub_cancel_at_period_end?: boolean | null
  pass_tier?: string | null
  pass_expires_at?: string | null
}

export interface Access {
  /**
   * null = logged out, 'retail' = logged in without valid paid access.
   * Expired paid users collapse to 'retail' — several client components branch
   * on `userTier === null` to mean "logged out", so this shape must not change.
   */
  tier: Tier | null
  isAdmin: boolean
  membership: Membership
  expiresAt: Date | null
  /** Ladder gate, bound to this user. `access.atLeast('private')` */
  atLeast: (required: Tier) => boolean
  /**
   * Has ANY paid rung. Correct for nav, CTAs, the offer page and the account
   * page — but NOT for content gates: the full Vault library is 'private', the
   * schedule is 'desk', picks are 'portfolio'. Gate content with atLeast().
   */
  isPaid: boolean
  /**
   * @deprecated Shim for the pre-v3 `is_elite` content flag. Maps to 'private',
   * NOT 'institutional': the top two rungs differ on DEPTH of access (export,
   * query builder, API, backtester), not on which rows exist. Private is "the
   * finished product" and therefore includes every row. Migrate call sites to
   * atLeast('private') and delete this.
   */
  hasElite: boolean

  // ---- Billing surface. Zeroed unless BILLING_SELECT was in the select. ----
  /** 'pass' | 'subscription' | 'both' | 'none'. */
  billing: BillingMode
  /** Stripe status verbatim ('active' | 'past_due' | ...), or null. */
  subStatus: string | null
  /** Next automatic charge. null for pass-only members -- nothing renews. */
  renewsAt: Date | null
  /** True when a live subscription is set to stop at the period end. */
  cancelAtPeriodEnd: boolean
}

export function resolveAccess(
  profile: AccessProfile | null | undefined,
  isLoggedIn: boolean
): Access {
  const build = (tier: Tier | null, isAdmin: boolean, membership: Membership, expiresAt: Date | null): Access => ({
    tier,
    isAdmin,
    membership,
    expiresAt,
    atLeast: (required: Tier) => atLeastTier(tier, required),
    isPaid: atLeastTier(tier, 'portfolio'),
    hasElite: atLeastTier(tier, 'private'),
    billing: (profile?.billing_mode as BillingMode) ?? 'none',
    subStatus: profile?.subscription_status ?? null,
    renewsAt: profile?.sub_current_period_end ? new Date(profile.sub_current_period_end) : null,
    cancelAtPeriodEnd: !!profile?.sub_cancel_at_period_end,
  })

  if (!isLoggedIn) return build(null, false, 'logged-out', null)

  if (profile?.is_admin) return build('institutional', true, 'admin', null)

  const storedTier = normalizeTier(profile?.subscription_tier)
  const expiresAt = profile?.access_expires_at ? new Date(profile.access_expires_at) : null

  if (storedTier === 'retail') return build('retail', false, 'free', null)

  // A paid tier with a missing or past expiry has lapsed.
  const stillValid = !!expiresAt && expiresAt.getTime() > Date.now()
  if (!stillValid) return build('retail', false, 'expired', expiresAt)

  return build(storedTier, false, 'active', expiresAt)
}
