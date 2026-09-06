// Discord webhook channel.
//
// The server is one shared space with no tier separation, so a gated pick posts
// only its teaser here no matter who is watching — renderPick already enforces
// that. Discord is the broadest-reach, lowest-trust channel of the three.

import type { NotifiablePick, PickAudience } from './audience'
import { renderPick } from './message'

const BRAND_COLOR = 0x2dd4bf

/**
 * Role to ping, by rung. An embed alone produces no notification — Discord only
 * pushes to a member's device when they're actually mentioned, and a mention
 * only counts if it sits in `content`, never inside an embed.
 *
 * TWO ROLES, NOT FIVE. The server is one shared channel with no tier
 * separation, and five roles for five paying members is machinery maintained
 * for nobody. Retail pings the free role, every paid rung pings the members
 * role. Split it per rung when a rung has the population to justify it.
 */
function roleIdFor(audience: PickAudience): string | undefined {
  const id = audience === 'retail'
    ? process.env.DISCORD_FREE_ROLE_ID
    : process.env.DISCORD_MEMBERS_ROLE_ID
  return id || undefined
}

export async function sendDiscord(
  pick: NotifiablePick,
  audience: PickAudience
): Promise<{ sent: number; mentioned: string | null }> {
  const webhook = process.env.DISCORD_WEBHOOK_URL
  if (!webhook) return { sent: 0, mentioned: null }

  const { title, body, url } = renderPick(pick, audience)

  const fields: Array<{ name: string; value: string; inline: boolean }> = []
  // The pick itself is NOT posted here, free ones included. Printing the bet and
  // line in Discord gave the audience we most want on the site no reason to
  // visit it. Sport and risk are context, not the pick.
  if (pick.sport) fields.push({ name: 'Sport', value: pick.sport, inline: true })
  if (pick.risk) fields.push({ name: 'Risk', value: pick.risk, inline: true })

  const roleId = roleIdFor(audience)

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'EdTheStatMan',
      content: roleId ? `<@&${roleId}>` : undefined,
      // Explicit allow-list. Without it a webhook's role mention renders as
      // inert text unless the role is flagged mentionable; with it, the ping
      // lands regardless. Also pins the blast radius to this one role, so a
      // stray @everyone in pick text can never go out.
      allowed_mentions: { parse: [], roles: roleId ? [roleId] : [] },
      embeds: [
        {
          title,
          description: body,
          url,
          color: BRAND_COLOR,
          fields,
          footer: { text: pick.date ? `Pick date: ${pick.date}` : 'edthestatman.com' },
        },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`)
  }

  return { sent: 1, mentioned: roleId ?? null }
}
