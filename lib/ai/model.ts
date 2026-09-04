// Which model answers, and through which provider.
//
// TWO PROVIDERS, chosen by which credential is present. This exists because the
// Vercel AI Gateway refuses every request from a team with no card on file
// (`403 customer_verification_required`), which blocked the bot entirely --
// locally and deployed -- with nothing wrong in the code.
//
//   GOOGLE_GENERATIVE_AI_API_KEY set -> Google, direct. Free tier, no card.
//   otherwise                        -> the Vercel AI Gateway, as before.
//
// The gateway path is deliberately kept rather than deleted. Adding a card is
// still the better long-term answer -- fallbacks, unified spend, and a data
// policy that suits a paid product -- and when that happens this file reverts
// by removing one environment variable.

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { Tier } from '@/lib/access'

/**
 * Gateway model per rung. Plain "provider/model" strings, resolved by the
 * gateway, so credentials stay there rather than in this app.
 *
 * Retail is free and capped, and its questions are mostly "what do I get",
 * which explain_membership answers from a static catalogue. The Desk and above
 * reason over real rows, where the better model earns its cost.
 */
const GATEWAY_MODEL: Record<Tier, string> = {
  retail: 'anthropic/claude-sonnet-5',
  portfolio: 'anthropic/claude-sonnet-5',
  desk: 'anthropic/claude-opus-5',
  private: 'anthropic/claude-opus-5',
  institutional: 'anthropic/claude-opus-5',
}

/** Signed-out visitors get the retail model; the cap is what bounds their cost. */
const GATEWAY_ANON_MODEL = 'anthropic/claude-sonnet-5'

/**
 * Google model ids, overridable without a code change.
 *
 * OVERRIDABLE ON PURPOSE. Google renames and retires model ids on their own
 * schedule, and a stale id is a hard failure on every message with a confusing
 * error. Setting STATBOT_GOOGLE_MODEL in the environment fixes that in one line
 * instead of a deploy. The defaults are Flash-class because the free tier does
 * not serve Pro -- it moved to paid-only in April 2026.
 *
 * There is no per-rung split here. On the free tier the meaningful limit is
 * requests per day, not model quality, and a single model keeps the failure
 * surface to one id instead of five.
 */
const GOOGLE_MODEL = process.env.STATBOT_GOOGLE_MODEL || 'gemini-3.5-flash'

/** True when a direct Google key is configured. */
export function usingGoogle(): boolean {
  return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
}

/**
 * The model for one caller.
 *
 * Returns either a LanguageModel instance (Google) or a gateway id string;
 * streamText accepts both, so the caller does not branch.
 */
export function modelFor(tier: Tier | null): any {
  if (usingGoogle()) {
    const google = createGoogleGenerativeAI({
      apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
    })
    return google(GOOGLE_MODEL)
  }
  return tier ? GATEWAY_MODEL[tier] : GATEWAY_ANON_MODEL
}

/** What is actually serving requests, for logs and the health check. */
export function modelLabel(tier: Tier | null): string {
  return usingGoogle()
    ? `google:${GOOGLE_MODEL}`
    : `gateway:${tier ? GATEWAY_MODEL[tier] : GATEWAY_ANON_MODEL}`
}
