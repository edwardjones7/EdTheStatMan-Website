// Who gets told about a given pick.
//
// The audience is derived from the pick's own flags, not from the tier of
// whoever created it. Keep this in step with the read-side gating in
// lib/access.ts — if a member can't open the pick on the site, they must not
// receive a notification that reveals it.

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAccess, ACCESS_SELECT } from '@/lib/access'

export type PickAudience = 'everyone' | 'members'

export interface NotifiablePick {
  id: string
  date: string | null
  sport: string | null
  risk: string | null
  bet: string | null
  line: string | null
  is_free?: boolean | null
  is_elite?: boolean | null
  is_active?: boolean | null
}

/**
 * null means "notify nobody".
 *
 * Elite picks deliberately notify nobody for now: the elite tier isn't fully
 * integrated yet, so elite alerts stay switched off until it is. Checked first
 * so an elite pick flagged free still stays silent.
 *
 * Anything not explicitly free is treated as paid — failing closed here means a
 * mis-flagged pick under-notifies rather than leaking to the whole list.
 */
export function audienceForPick(pick: NotifiablePick): PickAudience | null {
  if (pick.is_elite) return null
  if (pick.is_free) return 'everyone'
  return 'members'
}

/** True when the pick's content must stay behind the paywall in the message body. */
export function isGated(audience: PickAudience): boolean {
  return audience !== 'everyone'
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
      // 'members' mirrors the site's own gate in app/model-picks/page.tsx,
      // which shows every non-free pick to any paying member.
      if (audience === 'members') return resolveAccess(row, true).isPaid
      return true
    })
    .map((row) => ({
      id: row.id,
      email: row.email,
      notifyToken: row.notify_token,
      emailOptIn: row.notify_email !== false,
    }))
}
