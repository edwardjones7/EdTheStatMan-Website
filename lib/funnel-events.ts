/**
 * Every funnel event the site records, in one list the ingest route
 * (app/api/track) validates against and the client helper is typed by.
 * Order is the funnel, top to bottom.
 */
export const FUNNEL_EVENTS = [
  'pick_view',         // a public pick page was opened
  'paywall_view',      // a lock/gate was rendered to this visitor
  'signup_prompt_click',
  'signup_start',      // signup form focused / submitted
  'signup_complete',   // account created (server side, auth callback)
  'magic_link_sent',
  'push_opt_in',
  'discord_connect',
  'plan_toggle',       // 30-day / 365-day switch on /win
  'trial_started',     // Research Desk free trial begun (server side, /api/trial)
  'checkout_click',
  'checkout_started',  // Stripe session created
  'purchase',          // webhook confirmed payment
] as const

export type FunnelEvent = (typeof FUNNEL_EVENTS)[number]
