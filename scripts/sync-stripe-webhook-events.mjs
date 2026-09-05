/**
 * Subscribe the Stripe webhook endpoint to every event the v3 handler implements.
 *
 *   node scripts/sync-stripe-webhook-events.mjs                 # dry run, test
 *   node scripts/sync-stripe-webhook-events.mjs --write         # apply, test
 *   node scripts/sync-stripe-webhook-events.mjs --write --live  # apply, LIVE
 *
 * WHY THIS EXISTS. The live endpoint was created subscribed to exactly one
 * event, checkout.session.completed. app/api/stripe/webhook/route.ts implements
 * seven. The six missing ones are not cosmetic:
 *
 *   customer.subscription.created  a new subscription never grants access
 *   customer.subscription.updated  a plan change or cancel-at-period-end is lost
 *   customer.subscription.deleted  a cancellation never revokes access
 *   invoice.payment_succeeded      a RENEWAL never extends access, so a monthly
 *                                  member silently loses the site after month one
 *   invoice.payment_failed         no past_due marking, no dunning signal
 *   charge.refunded                a refund never revokes access
 *
 * Safe to run before the v3 deploy: the currently deployed handler matches only
 * `checkout.session.completed` and returns 200 for everything else, and there
 * are no subscriptions in the account yet, so nothing new actually fires.
 */

import Stripe from 'stripe'
import fs from 'fs'
import path from 'path'

const argv = process.argv.slice(2)
const WRITE = argv.includes('--write')
const LIVE = argv.includes('--live')

// Must stay in step with the switch in app/api/stripe/webhook/route.ts.
const REQUIRED_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'charge.refunded',
]

const envPath = path.join(process.cwd(), '.env.local')
if (!fs.existsSync(envPath)) {
  console.error('No .env.local found. Run this from the repo root.')
  process.exit(1)
}
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)

const key = LIVE ? env.STRIPE_SECRET_KEY : env.STRIPE_TEST_SECRET_KEY
if (!key) {
  console.error(LIVE ? 'STRIPE_SECRET_KEY is not set.' : 'STRIPE_TEST_SECRET_KEY is not set. Pass --live to use the live key.')
  process.exit(1)
}
const stripe = new Stripe(key)

console.log(`Stripe mode : ${LIVE ? 'LIVE' : 'test'}`)
console.log(`Action      : ${WRITE ? 'APPLY' : 'dry run'}\n`)

const hooks = await stripe.webhookEndpoints.list({ limit: 20 })
if (!hooks.data.length) {
  console.error('No webhook endpoints in this Stripe mode. Create one pointing at')
  console.error('  <your domain>/api/stripe/webhook')
  console.error('then re-run. (In test mode, `stripe listen` is usually easier.)')
  process.exit(1)
}

for (const h of hooks.data) {
  console.log(`${h.id}  ${h.status}`)
  console.log(`  url     ${h.url}`)

  const have = new Set(h.enabled_events)
  const missing = REQUIRED_EVENTS.filter(e => !have.has(e))
  const extra = h.enabled_events.filter(e => !REQUIRED_EVENTS.includes(e) && e !== '*')

  console.log(`  has     ${h.enabled_events.join(', ')}`)
  if (!missing.length) {
    console.log('  -> already subscribed to every event the handler implements\n')
    continue
  }
  console.log(`  MISSING ${missing.join(', ')}`)
  if (extra.length) console.log(`  extra   ${extra.join(', ')} (left in place)`)

  if (!WRITE) {
    console.log('  -> dry run, not changed\n')
    continue
  }

  // Union rather than replace: never silently drop an event someone added in
  // the dashboard for a reason this script does not know about.
  const next = Array.from(new Set([...h.enabled_events, ...REQUIRED_EVENTS]))
  const updated = await stripe.webhookEndpoints.update(h.id, { enabled_events: next })
  console.log(`  -> updated, now ${updated.enabled_events.length} events\n`)
}

if (!WRITE) console.log('Dry run. Re-run with --write to apply.')
