// One place that decides what a notification is allowed to say.
//
// Every channel renders from renderPick() so a paywall fix can't land on email
// and miss Discord. Gated picks get the same treatment as lib/teaser.ts gives
// the site: the pick EXISTS and here's the sport — the bet, line, vig and note
// never leave the server.

import type { NotifiablePick, PickAudience } from './audience'
import { isGated } from './audience'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edthestatman.com'

const AUDIENCE_LABEL: Record<PickAudience, string> = {
  everyone: 'Free pick',
  members: 'Members pick',
}

export interface RenderedMessage {
  title: string
  /**
   * Safe in any channel, for any audience. Never contains the pick itself, so
   * email — where gambling odds in the body trip spam filters — uses only this.
   */
  body: string
  /**
   * The pick itself, or null when the audience isn't entitled to it. Channels
   * opt in; a gated pick returns null here no matter who asks, so no channel can
   * leak one even by mistake.
   */
  detail: string | null
  url: string
}

export function renderPick(pick: NotifiablePick, audience: PickAudience): RenderedMessage {
  const sport = pick.sport ?? 'New'
  const label = AUDIENCE_LABEL[audience]
  const url = `${SITE_URL}/portfolio`

  if (isGated(audience)) {
    return {
      title: `${label} just dropped`,
      body: `A new ${sport} pick is live. Log in to view it.`,
      detail: null,
      url,
    }
  }

  const detail = [pick.bet, pick.line].filter(Boolean).join(' ')
  return {
    title: `${label}: ${sport}`,
    // Deliberately no odds — see `body` above.
    body: `A new free ${sport} pick is live.`,
    detail: detail || null,
    url,
  }
}
