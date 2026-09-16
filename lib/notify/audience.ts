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
 * The ids of every account that has actually confirmed its email address.
 *
 * WHY THIS EXISTS. A signup bot hit the form 86 times between 10 and 16 Sep
 * 2026 using HARVESTED THIRD-PARTY ADDRESSES -- state.gov, a law firm, several
 * .edu and .gov inboxes, an SMS gateway -- so the confirmation mail would land
 * on strangers. `profiles` has a row for every one of them, and this function's
 * caller reads every row in that table, so without this filter the next pick
 * mails all of them. That is unsolicited mail from our domain to inboxes that
 * report abuse, which is how a sending domain gets blocklisted and takes the
 * contact form and the Stripe receipts down with it.
 *
 * CONFIRMED IS THE RIGHT LINE, and it was chosen against the data rather than
 * by feel. Measured 2026-09-16: all 185 pre-existing accounts are confirmed, so
 * this costs nothing legitimate, and it drops 69 of the 86 bot rows. A stricter
 * "must have signed in" rule would drop 85 of 86, but it would also silence 154
 * of the 165 real subscribers imported from WordPress, who have never signed in
 * to this site. Confirmation is also simply what opted-in means.
 *
 * IT IS NOT A COMPLETE FILTER. 17 of the bot rows ARE confirmed, because
 * corporate mail security (Proofpoint, Mimecast, Defender Safe Links) fetches
 * every link in an inbound message and so clicks the verify link on the
 * victim's behalf. Nothing readable from this table separates those from a real
 * member. The actual fix is to stop the signups: BotID on the form, and a
 * CAPTCHA in Supabase Auth.
 *
 * READ FROM auth.users, NOT FROM A COLUMN. `email_confirmed_at` lives in the
 * auth schema, which PostgREST does not expose, so this is the admin API rather
 * than a join. One call per 1000 accounts on a background path -- 272 accounts
 * today, so one call. If the list ever grows enough for that to matter, the
 * answer is a synced column on `profiles` and a trigger, not dropping the check.
 */
async function confirmedAccountIds(): Promise<Set<string>> {
  const admin = createAdminClient()
  const ids = new Set<string>()

  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`Failed to load confirmed accounts: ${error.message}`)
    for (const user of data.users) {
      if (user.email_confirmed_at) ids.add(user.id)
    }
    if (data.users.length < 1000) break
  }

  return ids
}

/**
 * Every CONFIRMED account, split by whether they can open this pick.
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
 *
 * THIS THROWS RATHER THAN DEGRADING if the confirmed list cannot be loaded.
 * notifyNewPick() catches it, email and push then send to nobody, and Discord
 * still posts. That is the right direction to fail: a pick that goes unmailed
 * can be mailed again, and mail sent to a harvested address cannot be recalled.
 */
export async function splitRecipients(
  audience: PickAudience
): Promise<{ entitled: Recipient[]; locked: Recipient[] }> {
  const admin = createAdminClient()

  const [confirmed, { data, error }] = await Promise.all([
    confirmedAccountIds(),
    (admin as any)
      .from('profiles')
      .select(`id, email, notify_email, notify_token, ${ACCESS_SELECT}`),
  ])

  if (error) throw new Error(`Failed to load recipients: ${error.message}`)

  const rows = (data ?? []) as Array<Record<string, any>>
  const entitled: Recipient[] = []
  const locked: Recipient[] = []

  for (const row of rows) {
    if (!row.email) continue
    // Never mail an address nobody proved they own. See confirmedAccountIds().
    if (!confirmed.has(row.id)) continue
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
