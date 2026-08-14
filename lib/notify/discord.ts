// Discord webhook channel.
//
// The server is one shared space with no tier separation, so a gated pick posts
// only its teaser here no matter who is watching — renderPick already enforces
// that. Discord is the broadest-reach, lowest-trust channel of the three.

import type { NotifiablePick, PickAudience } from './audience'
import { renderPick } from './message'

const BRAND_COLOR = 0x2dd4bf

/**
 * Role to ping, by audience. An embed alone produces no notification — Discord
 * only pushes to a member's device when they're actually mentioned, and a
 * mention only counts if it sits in `content`, never inside an embed.
 */
function roleIdFor(audience: PickAudience): string | undefined {
  const id = audience === 'everyone'
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

  const { title, body, detail, url } = renderPick(pick, audience)

  const fields: Array<{ name: string; value: string; inline: boolean }> = []
  // Discord isn't an inbox, so no spam filter to dodge — show the pick in full
  // whenever the audience is entitled to it. `detail` is null for gated picks.
  if (detail) fields.push({ name: 'Pick', value: detail, inline: false })
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
