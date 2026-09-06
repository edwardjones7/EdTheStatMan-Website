// Grant and revoke the Discord Members role from the site's own entitlement.
//
// SOURCE OF TRUTH IS SUPABASE, NOT STRIPE. Every paying member here holds a
// one-time pass, not a subscription, so Stripe has nothing to read -- see
// supabase/migrations/discord_01_link.sql. Entitlement comes from
// resolveAccess(), the same function the site gates with.
//
// CONTRACT: nothing in here ever throws. This runs inside the Stripe webhook,
// and a Discord outage must never fail a payment. Every path returns a result
// object and logs; callers ignore it.

import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAccess, ACCESS_SELECT } from '@/lib/access'

const API = 'https://discord.com/api/v10'

export type SyncOutcome =
  | 'granted' | 'revoked' | 'already-correct'
  | 'not-linked' | 'not-configured' | 'left-server' | 'error'

export interface SyncResult {
  outcome: SyncOutcome
  detail?: string
}

function config() {
  const token = process.env.DISCORD_BOT_TOKEN
  const guild = process.env.DISCORD_GUILD_ID
  const role = process.env.DISCORD_MEMBERS_ROLE_ID
  if (!token || !guild || !role) return null
  return { token, guild, role }
}

/** PUT/DELETE on the member-role endpoint. 204 is success; 404 means gone. */
async function roleCall(
  method: 'PUT' | 'DELETE',
  discordUserId: string,
  cfg: { token: string; guild: string; role: string }
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(
    `${API}/guilds/${cfg.guild}/members/${discordUserId}/roles/${cfg.role}`,
    { method, headers: { Authorization: `Bot ${cfg.token}` } }
  )
  // 204 No Content on success; Discord sends no body.
  const body = res.status === 204 ? '' : await res.text().catch(() => '')
  return { ok: res.ok, status: res.status, body }
}

/**
 * Bring one member's Discord role in line with their access.
 *
 * `entitledOverride` lets the sweep pass a value it already computed rather
 * than re-reading the profile row per member.
 */
export async function syncDiscordRole(userId: string): Promise<SyncResult> {
  const cfg = config()
  if (!cfg) return { outcome: 'not-configured' }

  try {
    const admin = createAdminClient()
    const { data, error } = await (admin as any)
      .from('profiles')
      .select(`discord_user_id, ${ACCESS_SELECT}`)
      .eq('id', userId)
      .single()

    if (error || !data) return { outcome: 'error', detail: error?.message ?? 'no profile' }
    if (!data.discord_user_id) return { outcome: 'not-linked' }

    const entitled = resolveAccess(data, true).isPaid
    return await applyRole(data.discord_user_id, entitled, cfg)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error(`[discord] sync failed for ${userId}:`, detail)
    return { outcome: 'error', detail }
  }
}

async function applyRole(
  discordUserId: string,
  entitled: boolean,
  cfg: { token: string; guild: string; role: string }
): Promise<SyncResult> {
  const res = await roleCall(entitled ? 'PUT' : 'DELETE', discordUserId, cfg)

  if (res.ok) return { outcome: entitled ? 'granted' : 'revoked' }

  // The member is not in the server any more. Nothing to do and nothing wrong:
  // revoking a role from someone who left is already the desired end state.
  if (res.status === 404) return { outcome: 'left-server' }

  // 50013 is the hierarchy trap: the bot cannot touch a role positioned at or
  // above its own. It reads like a missing permission, so name it explicitly.
  if (res.body.includes('50013')) {
    console.error(
      '[discord] Missing Permissions (50013). The bot role must sit ABOVE the ' +
      'Members role in Server Settings > Roles, and needs Manage Roles.'
    )
    return { outcome: 'error', detail: 'bot role is not above the members role' }
  }

  console.error(`[discord] role ${entitled ? 'grant' : 'revoke'} failed:`, res.status, res.body.slice(0, 200))
  return { outcome: 'error', detail: `${res.status} ${res.body.slice(0, 120)}` }
}

/**
 * Reconcile every linked member.
 *
 * THE SWEEP IS NOT OPTIONAL. Granting can be event-driven -- a purchase fires a
 * Stripe webhook -- but LAPSING FIRES NOTHING. A one-time pass simply reaches
 * its expiry date and Stripe has no opinion about it, so without a scheduled
 * pass a lapsed member keeps the role, the pings and the channel access forever.
 */
export async function syncAllDiscordRoles(): Promise<Record<SyncOutcome, number> & { checked: number }> {
  const tally: any = {
    granted: 0, revoked: 0, 'already-correct': 0,
    'not-linked': 0, 'not-configured': 0, 'left-server': 0, error: 0, checked: 0,
  }

  const cfg = config()
  if (!cfg) { tally['not-configured'] = 1; return tally }

  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('profiles')
    .select(`id, discord_user_id, ${ACCESS_SELECT}`)
    .not('discord_user_id', 'is', null)

  if (error) { tally.error = 1; return tally }

  for (const row of (data ?? []) as any[]) {
    tally.checked++
    const entitled = resolveAccess(row, true).isPaid
    const res = await applyRole(row.discord_user_id, entitled, cfg)
    tally[res.outcome] = (tally[res.outcome] ?? 0) + 1
    // Discord allows bursts but throttles per-route; a short pause keeps a
    // growing member list from tripping 429s mid-sweep.
    await new Promise(r => setTimeout(r, 250))
  }

  return tally
}
