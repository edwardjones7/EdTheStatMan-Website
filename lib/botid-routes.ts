/**
 * The routes BotID guards, named once so the client and the server cannot drift.
 *
 * This list has to match the places that call `checkBotId()` EXACTLY. The
 * <BotIdClient> in app/layout.tsx is what makes the browser attach the
 * classification headers, and it only does so for the paths named here, so a
 * route that calls checkBotId() without being listed classifies every visitor
 * as a bot -- including real ones.
 *
 * WHY /signup. Between 10 and 16 Sep 2026 a headless browser drove this form 86
 * times, submitting harvested third-party addresses (state.gov, a law firm,
 * several .edu and .gov inboxes, an SMS gateway) so that OUR domain would send
 * the confirmation mail to strangers. It came from datacenter IPs in DE, SE and
 * NL, paced roughly hourly across all 24 hours to stay under Supabase's rate
 * limits, and every request carried one identical stale Chrome/142 user agent.
 * It executes JavaScript and drives the real form, so a honeypot field or a
 * user-agent block does not touch it; this is the layer that does.
 *
 * THE PATH IS THE PAGE, NOT THE ACTION. `signup` is a Server Action invoked
 * from /signup, and a Server Action POSTs to the URL of the page it was called
 * from. So /signup + POST is what to protect.
 *
 * Basic checks are free on every plan and are what this relies on. Deep
 * Analysis is a dashboard toggle (Firewall > Rules > Vercel BotID Deep
 * Analysis) and is billed per checkBotId() call; turning it on requires no code
 * change here.
 */
/**
 * Structurally `Protect` from the botid package, which does not export the type
 * itself. Mutable, not `as const`: BotIdClient's prop is a mutable array and a
 * readonly tuple will not assign to it.
 */
export interface BotIdRoute {
  path: string
  method: string
}

export const BOTID_PROTECTED: BotIdRoute[] = [
  { path: '/signup', method: 'POST' },
]
