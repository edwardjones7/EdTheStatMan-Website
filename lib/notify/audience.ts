// Who gets told about a given pick.
//
// The audience is derived from the pick's own flags, not from the tier of
// whoever created it. Keep this in step with the read-side gating in
// lib/access.ts — if a member can't open the pick on the site, they must not
// receive a notification that reveals it.

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAccess, ACCESS_SELECT, type Tier } from '@/lib/access'
import { rowMinTier } from '@/lib/gate'

/**
 * The rung a pick is gated at. Notifications use the SAME vocabulary as the
 * read-side gate rather than a parallel one of their own -- the previous
 * 'everyone' | 'members' pair had already drifted out of step with a five-rung
 * ladder, and silently sent nothing at all for three of the five.
 */
export type PickAudience = Tier

export interface NotifiablePick {
  id: string
  date: string | null
  sport: string | null
  risk: string | null
  bet: string | null
  line: string | null
  min_tier?: string | null
  is_free?: boolean | null
  is_elite?: boolean | null
  is_active?: boolean | null
}

/**
 * The rung this pick sits at. Never null: every pick notifies whoever is
 * entitled to open it, and nobody else.
 *
 * rowMinTier() is the same helper the site gates with, so this reads min_tier
 * and falls back to the legacy is_free / is_elite pair exactly as the read path
 * does. An unflagged pick defaults to 'portfolio' -- failing CLOSED, so a
 * mis-saved pick under-notifies rather than mailing the whole list.
 *
 * This used to return null for anything is_elite, which silenced it entirely.
 * Correct when "elite" was one tier on top; under the ladder the admin route
 * sets is_elite for every rung above Portfolio, so Desk, Private and
 * Institutional picks would each have notified NOBODY, without an error.
 */
export function audienceForPick(pick: NotifiablePick): PickAudience {
  return rowMinTier(pick as any, 'portfolio')
}

export interface Recipient {
  id: string
  email: string
  notifyToken: string
  emailOptIn: boolean
}

/**
 * Members eligible for `audience`, with expired access already filtered out by
 * resolveAccess (a lapsed premium profile still reads subscription_tier
 * 'premium', so filtering on the column alone would notify people who can no
 * longer open the pick).
 */
export async function recipientsFor(audience: PickAudience): Promise<Recipient[]> {
  const admin = createAdminClient()

  const { data, error } = await (admin as any)
    .from('profiles')
    .select(`id, email, notify_email, notify_token, ${ACCESS_SELECT}`)

  if (error) throw new Error(`Failed to load recipients: ${error.message}`)

  const rows = (data ?? []) as Array<Record<string, any>>

  return rows
    .filter((row) => {
      if (!row.email) return false
      // The ladder predicate, not a parallel rule: if they could open the pick
      // on the site, they hear about it. Inclusive, so a Private member is
      // atLeast('desk') and gets Desk picks without being listed anywhere.
      // Every row here is a registered profile, so all of them clear 'retail'.
      return resolveAccess(row, true).atLeast(audience)
    })
    .map((row) => ({
      id: row.id,
      email: row.email,
      notifyToken: row.notify_token,
      emailOptIn: row.notify_email !== false,
    }))
}
