// Single source of truth for "what can this person see?".
//
// Access is decided by `access_expires_at` alone. `subscription_status` is
// deliberately NOT read: the Stripe webhook sets it to 'active' on purchase and
// never clears it, so anything gating on it treats expired users as paid.
//
// Pure module — no server imports — so client components can use it too.

/**
 * The Nov 2026 product set. NOT a ladder any more: three products, two of them
 * siblings, and one that holds everything.
 *
 *   retail        Free                                  free
 *   portfolio     EdTheStatBot Portfolio (the picks)    $29 / 30 days, $249 / 365 days
 *   private       Handicapping Vault (systems, trends)  $39 / 30 days, $349 / 365 days
 *   desk          The Research Desk (all of the above   $79 / 30 days, $699 / 365 days
 *                 plus the game boards)                 7-day free trial, no card
 *
 * The stored values did not change ('private' is the Vault in the database),
 * so no profile or content row had to be rewritten. 'institutional' folded into
 * the Vault: it is a legacy value now, mapped to 'private' on read.
 *
 * Portfolio and Vault are SEPARATE. Buying one never opens the other; the
 * Research Desk is the only thing that holds both. That is why gating goes
 * through tierCovers() below and not through a rank comparison.
 */
export type Tier = 'retail' | 'portfolio' | 'private' | 'desk'

/**
 * Price order, cheapest first. Use for "the cheapest product that unlocks
 * this" and for display order, NEVER for access: Vault outranks Portfolio here
 * and still does not open a single pick.
 */
export const TIER_RANK: Record<Tier, number> = {
  retail: 0,
  portfolio: 1,
  private: 2,
  desk: 3,
}

/** What each product opens. The one place entitlement is defined. */
const COVERS: Record<Tier, Tier[]> = {
  retail: ['retail'],
  portfolio: ['retail', 'portfolio'],
  private: ['retail', 'private'],
  desk: ['retail', 'portfolio', 'private', 'desk'],
}

/** Full product names. The single source of tier copy for the whole app. */
export const TIER_LABEL: Record<Tier, string> = {
  retail: 'Free',
  portfolio: 'EdTheStatBot Portfolio',
  private: 'Handicapping Vault',
  desk: 'The Research Desk',
}

/** Short names for nav pills, badges and inline confirmations. */
export const TIER_SHORT_LABEL: Record<Tier, string> = {
  retail: 'Free',
  portfolio: 'Portfolio',
  private: 'Vault',
  desk: 'Research Desk',
}

/**
 * What an admin may gate a row at, per surface.
 *
 * Not the whole ladder, because not every rung gates every table. A Vault row
 * offered at 'portfolio' or 'desk' would be unreachable: those are separate
 * products with their own pages and neither renders the Vault library. A pick
 * offered at 'institutional' would be a pick nobody has ever been sold.
 *
 * Both lists dropped 'elite'. It was a boolean beside is_free in the pre-v3
 * pair and the ladder absorbed it: the whole Vault library IS the Private
 * product, and what used to be Elite is Institutional. On the picks side the
 * old Edge Pick is 'private', which is why buying the Vault is what unlocks
 * one — the same split app/portfolio/page.tsx makes when it decides whether a
 * locked pick advertises the Portfolio or the Vault.
 *
 * Production agrees with both lists as of 2026-09-05: systems and trends sit at
 * retail / private / institutional, picks at retail / portfolio, and is_elite
 * is false on every row of all three tables.
 */
export interface AccessOption { value: Tier; label: string }

/** betting_systems and betting_trends. */
export const VAULT_ACCESS_OPTIONS: AccessOption[] = [
  { value: 'retail', label: 'Free' },
  { value: 'private', label: 'Vault members' },
]

/** todays_bets. */
export const PICK_ACCESS_OPTIONS: AccessOption[] = [
  { value: 'retail', label: 'Free' },
  { value: 'portfolio', label: 'Portfolio' },
  { value: 'private', label: 'Edge pick (Vault members)' },
]

/**
 * Row badge for the admin lists. The CSS variants are the pre-v3 names —
 * free / members / elite — and are left alone: they are three colours, and
 * renaming them would mean touching every card in the Vault for no visible
 * gain.
 */
export function accessBadge(minTier: string | null | undefined): { variant: string; label: string } {
  switch (normalizeTier(minTier)) {
    case 'retail': return { variant: 'free', label: 'Free' }
    case 'portfolio': return { variant: 'members', label: 'Portfolio' }
    case 'desk': return { variant: 'elite', label: 'Desk' }
    default: return { variant: 'members', label: 'Vault' }
  }
}

/** Ladder order, lowest first. Safe to iterate for UI. */
export const TIERS: Tier[] = ['retail', 'portfolio', 'private', 'desk']

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
  elite: 'private',
  // Folded into the Vault in Nov 2026. Rows and profiles may still hold it.
  institutional: 'private',
}

/** Normalize any stored tier string (legacy or current) onto the ladder. */
export function normalizeTier(value: string | null | undefined): Tier {
  if (!value) return 'retail'
  if (value in TIER_RANK) return value as Tier
  return LEGACY_TIER[value] ?? 'retail'
}

/**
 * Does `tier` open content gated at `required`? The one gate every check
 * funnels through.
 *
 * Named for the old ladder, kept so the dozens of call sites read the same,
 * but it is a lookup in COVERS now, not a rank comparison: a Vault member is
 * "above" the Portfolio on price and still does not get the picks.
 *
 * Takes a raw string so client components -- which only ever receive
 * `userTier: string | null` as a prop -- can call it directly, and so a legacy
 * value still in the column resolves correctly.
 */
export function atLeastTier(tier: string | null | undefined, required: string): boolean {
  if (tier === null || tier === undefined) return false
  return COVERS[normalizeTier(tier)].includes(normalizeTier(required))
}

/** True for any paid rung. Use instead of hand-written tier lists. */
export function isPaidTier(tier: string | null | undefined): boolean {
  if (tier === null || tier === undefined) return false
  return normalizeTier(tier) !== 'retail'
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
  /** Content gate, bound to this user. `access.atLeast('private')` opens the Vault. */
  atLeast: (required: Tier) => boolean
  /**
   * Has ANY paid rung. Correct for nav, CTAs, the offer page and the account
   * page — but NOT for content gates: the full Vault library is 'private', the
   * schedule is 'desk', picks are 'portfolio'. Gate content with atLeast().
   */
  isPaid: boolean
  /**
   * @deprecated Shim for the pre-v3 `is_elite` content flag. Maps to 'private',
   * NOT 'institutional': the top two rungs differ on DEPTH of access (query
   * builder, API, backtester), not on which rows exist. Private is "the
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
    isPaid: !!tier && tier !== 'retail',
    hasElite: atLeastTier(tier, 'private'),
    billing: (profile?.billing_mode as BillingMode) ?? 'none',
    subStatus: profile?.subscription_status ?? null,
    renewsAt: profile?.sub_current_period_end ? new Date(profile.sub_current_period_end) : null,
    cancelAtPeriodEnd: !!profile?.sub_cancel_at_period_end,
  })

  if (!isLoggedIn) return build(null, false, 'logged-out', null)

  if (profile?.is_admin) return build('desk', true, 'admin', null)

  const storedTier = normalizeTier(profile?.subscription_tier)
  const expiresAt = profile?.access_expires_at ? new Date(profile.access_expires_at) : null

  if (storedTier === 'retail') return build('retail', false, 'free', null)

  // A paid tier with a missing or past expiry has lapsed.
  const stillValid = !!expiresAt && expiresAt.getTime() > Date.now()
  if (!stillValid) return build('retail', false, 'expired', expiresAt)

  return build(storedTier, false, 'active', expiresAt)
}
