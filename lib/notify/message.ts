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
  /** Button label. Has to match what the page will actually give this reader. */
  cta: string
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
    cta: 'View the pick',
  }
}

/**
 * The same announcement, for somebody who cannot open the pick.
 *
 * Sent to every account below the pick's rung, so a name that has been sitting
 * in the database since February still hears that the model is working. It
 * gives away no more than the entitled version does, because that one carries
 * nothing either -- the difference is entirely in what it PROMISES.
 *
 * "Log in to view it" is the wrong sentence for this reader. They can log in,
 * and the pick still will not be there. A mail that sends somebody to a page
 * that does not contain what the button offered is worse for the list than no
 * mail at all: it is the reader's one data point about whether we are honest,
 * and it converts a dormant account into an unsubscribe. So this variant says
 * what is true -- a pick exists, at a rung above yours -- and the button offers
 * the board rather than the pick.
 *
 * It points at /portfolio, not at /win. The locked board shows how many plays
 * are sitting there and carries its own upgrade path, which argues the case
 * better than a price list does.
 */
export function renderPickLocked(pick: NotifiablePick, audience: PickAudience): RenderedMessage {
  const sport = pick.sport ?? 'New'
  const tier = TIER_SHORT_LABEL[audience]
  const url = `${SITE_URL}/portfolio`

  return {
    title: `A new ${sport} pick just dropped`,
    body: `The model is on a new ${sport} play. It is open to ${tier} members — see what is on the board today.`,
    url,
    cta: 'See the board',
  }
}
