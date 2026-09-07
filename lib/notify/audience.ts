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

function toRecipient(row: Record<string, any>): Recipient {
  return {
    id: row.id,
    email: row.email,
    notifyToken: row.notify_token,
    emailOptIn: row.notify_email !== false,
  }
}

/**
 * Every account, split by whether they can open this pick.
 *
 * `entitled` is the audience that has always been notified. `locked` is
 * everybody else with an account -- the free rung, a lapsed member, somebody who
 * signed up in February and never came back.
 *
 * Expired access is filtered by resolveAccess rather than by the column: a
 * lapsed profile still reads subscription_tier 'private', so filtering on that
 * alone would put somebody in `entitled` who can no longer open the pick. It
 * also means a lapsed member lands in `locked` and hears that the model is
 * still working, which is the whole point of mailing that list.
 */
export async function splitRecipients(
  audience: PickAudience
): Promise<{ entitled: Recipient[]; locked: Recipient[] }> {
  const admin = createAdminClient()

  const { data, error } = await (admin as any)
    .from('profiles')
    .select(`id, email, notify_email, notify_token, ${ACCESS_SELECT}`)

  if (error) throw new Error(`Failed to load recipients: ${error.message}`)

  const rows = (data ?? []) as Array<Record<string, any>>
  const entitled: Recipient[] = []
  const locked: Recipient[] = []

  for (const row of rows) {
    if (!row.email) continue
    // The ladder predicate, not a parallel rule: if they could open the pick
    // on the site, they hear about it. Inclusive, so a Private member is
    // atLeast('desk') and gets Desk picks without being listed anywhere.
    // Every row here is a registered profile, so all of them clear 'retail'.
    if (resolveAccess(row, true).atLeast(audience)) entitled.push(toRecipient(row))
    else locked.push(toRecipient(row))
  }

  return { entitled, locked }
}

/**
 * Members eligible for `audience`. Push and Discord still use this: a browser
 * notification is a poor place to advertise, and the Discord post is one message
 * to a channel rather than a thing with an audience.
 */
export async function recipientsFor(audience: PickAudience): Promise<Recipient[]> {
  const { entitled } = await splitRecipients(audience)
  return entitled
}
