import type { Tier } from './access'

/**
 * Where an "unlock" goes when the rung that opens it is known: straight to that
 * plan on /win, season pass preselected (the SKU we push, lib/offer.ts). /win
 * reads `plan` and `period`; a /win that ignores them still lands correctly.
 *
 * A free ('retail') row has no plan to sell, so it gets plain /win here; the
 * callers that show free rows to logged-out visitors send those to signup.
 *
 * Its own pure module so server pages and client components can both call it.
 */
export function unlockHref(tier: Tier | null | undefined): string {
  if (!tier || tier === 'retail') return '/win'
  return `/win?plan=${tier}&period=season`
}
