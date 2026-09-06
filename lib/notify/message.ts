// One place that decides what a notification is allowed to say.
//
// Every channel renders from renderPick() so a paywall fix can't land on email
// and miss Discord. Gated picks get the same treatment as lib/teaser.ts gives
// the site: the pick EXISTS and here's the sport — the bet, line, vig and note
// never leave the server.

import type { NotifiablePick, PickAudience } from './audience'
import { TIER_SHORT_LABEL } from '@/lib/access'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edthestatman.com'

function audienceLabel(audience: PickAudience): string {
  return audience === 'retail' ? 'Free pick' : `${TIER_SHORT_LABEL[audience]} pick`
}

export interface RenderedMessage {
  title: string
  /**
   * Safe in any channel, for any audience. Never contains the pick itself, so
   * email — where gambling odds in the body trip spam filters — uses only this.
   */
  body: string
  url: string
}

/**
 * NO CHANNEL EVER CARRIES THE PICK, free ones included.
 *
 * Email and push never did -- they render title/body/url only. Discord used to
 * print the bet and line in full for free picks, which meant the one audience
 * we most want on the site had no reason to visit. Every notification is now an
 * announcement plus a link, and the pick itself exists only on /portfolio.
 *
 * That also collapses a whole class of paywall bug: there is no longer a code
 * path where the pick can reach a channel, so no future change can leak one by
 * getting an audience check wrong.
 */
export function renderPick(pick: NotifiablePick, audience: PickAudience): RenderedMessage {
  const sport = pick.sport ?? 'New'
  const label = audienceLabel(audience)
  const url = `${SITE_URL}/portfolio`

  return {
    title: `${label} just dropped`,
    body: audience === 'retail'
      ? `A new free ${sport} pick is live. View it on the site.`
      : `A new ${sport} pick is live. Log in to view it.`,
    url,
  }
}
