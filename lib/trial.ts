// The Research Desk free trial: 7 days, no card, one per account, and when it
// ends it simply ends. Nothing converts into a charge -- Ed's call, made with
// his father's chargeback rule in mind (Nov 2026).
//
// Storage is the ordinary pass slot plus one marker column
// (pricing_01_trial_and_pick_games.sql): the trial writes pass_tier = 'desk'
// and pass_expires_at = desk_trial_ends_at. So the whole read path --
// resolveAccess(), every gate, the nav -- treats a trial member as a Desk
// member without knowing trials exist.

import { resolveAccess } from './access'

export interface TrialProfile {
  desk_trial_ends_at?: string | null
  pass_tier?: string | null
  pass_expires_at?: string | null
}

/** Is the pass currently in the slot the free trial (not a purchase)? */
export function isTrialPass(p: TrialProfile | null | undefined): boolean {
  if (!p?.desk_trial_ends_at || !p.pass_expires_at || p.pass_tier !== 'desk') return false
  return Date.parse(p.pass_expires_at) === Date.parse(p.desk_trial_ends_at)
}

export interface TrialState {
  /** May start the trial now: logged in, never trialled, holds nothing paid. */
  available: boolean
  /** Their current Desk access is the trial, and it is still running. */
  onTrial: boolean
  endsAt: string | null
}

const NONE: TrialState = { available: false, onTrial: false, endsAt: null }

/**
 * Trial state for one member. Probe-and-degrade: before the migration the
 * select errors and the answer is "no trial", which hides the button.
 */
export async function loadTrialState(admin: any, userId: string | null | undefined): Promise<TrialState> {
  if (!userId) return NONE
  const { data, error } = await admin
    .from('profiles')
    .select('desk_trial_ends_at, pass_tier, pass_expires_at, subscription_tier, access_expires_at, is_admin')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return NONE

  const endsAt: string | null = data.desk_trial_ends_at ?? null
  const live = !!endsAt && Date.parse(endsAt) > Date.now()
  const onTrial = live && isTrialPass(data)
  const access = resolveAccess(data, true)
  return {
    available: !endsAt && !data.is_admin && !access.isPaid,
    onTrial,
    endsAt,
  }
}
