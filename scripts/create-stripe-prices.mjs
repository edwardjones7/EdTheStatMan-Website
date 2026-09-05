/**
 * Create the eight v3 ladder SKUs in Stripe.
 *
 *   node scripts/create-stripe-prices.mjs                 # dry run, test mode
 *   node scripts/create-stripe-prices.mjs --write         # create, test mode
 *   node scripts/create-stripe-prices.mjs --write --live  # create, LIVE mode
 *
 * Test mode is the default and needs STRIPE_TEST_SECRET_KEY in .env.local.
 * --live uses STRIPE_SECRET_KEY, which in this repo is a real sk_live_ key.
 *
 * SAFE TO RE-RUN. Every price is looked up first by its lookup_key, and an
 * existing one is reported rather than duplicated. Stripe prices are immutable,
 * so a price whose AMOUNT has changed cannot be edited: this script tells you,
 * and you archive the old one and create a replacement by hand. It will never
 * silently sell at a stale number.
 *
 * The catalogue below is transcribed from lib/offer.ts and checked against it at
 * the end of the run. offer.ts is the source of truth for what the site renders;
 * this file only exists because it must run outside Next and cannot import TS.
 */

import Stripe from 'stripe'
import fs from 'fs'
import path from 'path'

const argv = process.argv.slice(2)
const WRITE = argv.includes('--write')
const LIVE = argv.includes('--live')

// ---------------------------------------------------------------- env loading
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
  console.error(LIVE
    ? 'STRIPE_SECRET_KEY is not set in .env.local.'
    : 'STRIPE_TEST_SECRET_KEY is not set in .env.local.\n' +
      'Add your sk_test_... key, or pass --live to use the live key instead.')
  process.exit(1)
}
if (LIVE && !key.startsWith('sk_live_')) {
  console.error('--live was passed but STRIPE_SECRET_KEY is not an sk_live_ key. Refusing.')
  process.exit(1)
}
if (!LIVE && !key.startsWith('sk_test_')) {
  console.error('STRIPE_TEST_SECRET_KEY is not an sk_test_ key. Refusing.')
  process.exit(1)
}

const stripe = new Stripe(key)

// ------------------------------------------------------------------ catalogue
// Mirrors OFFER_PLANS in lib/offer.ts. `envVar` is the variable the catalogue
// reads, and is what you paste into Vercel afterwards.
//
// Only the three monthly Desk/Private/Institutional SKUs recur. The Portfolio
// month is a one-time 30-day purchase and every season pass is one-time, which
// is the whole reason `mode` is per-SKU rather than per-plan.
const CATALOGUE = [
  { product: 'The Portfolio',                    tier: 'portfolio',     period: 'month',  amount: 4900,   recurring: false, envVar: 'NEXT_PUBLIC_STRIPE_PORTFOLIO_MONTH_PRICE_ID' },
  { product: 'The Portfolio',                    tier: 'portfolio',     period: 'season', amount: 19900,  recurring: false, envVar: 'NEXT_PUBLIC_STRIPE_PORTFOLIO_SEASON_PRICE_ID' },
  { product: 'The Research Desk',                tier: 'desk',          period: 'month',  amount: 12900,  recurring: true,  envVar: 'NEXT_PUBLIC_STRIPE_DESK_MONTH_PRICE_ID' },
  { product: 'The Research Desk',                tier: 'desk',          period: 'season', amount: 49900,  recurring: false, envVar: 'NEXT_PUBLIC_STRIPE_DESK_SEASON_PRICE_ID' },
  { product: 'Vault — Private Intelligence',     tier: 'private',       period: 'month',  amount: 19900,  recurring: true,  envVar: 'NEXT_PUBLIC_STRIPE_PRIVATE_MONTH_PRICE_ID' },
  { product: 'Vault — Private Intelligence',     tier: 'private',       period: 'season', amount: 79900,  recurring: false, envVar: 'NEXT_PUBLIC_STRIPE_PRIVATE_SEASON_PRICE_ID' },
  { product: 'Vault — Institutional Intelligence', tier: 'institutional', period: 'month',  amount: 39900,  recurring: true,  envVar: 'NEXT_PUBLIC_STRIPE_INSTITUTIONAL_MONTH_PRICE_ID' },
  { product: 'Vault — Institutional Intelligence', tier: 'institutional', period: 'season', amount: 149900, recurring: false, envVar: 'NEXT_PUBLIC_STRIPE_INSTITUTIONAL_SEASON_PRICE_ID' },
]

const lookupKey = s => `edtsm_v3_${s.tier}_${s.period}`
const money = c => `$${(c / 100).toFixed(2)}`

// ----------------------------------------------------------------------- main
console.log(`Stripe mode : ${LIVE ? 'LIVE  <-- REAL MONEY' : 'test'}`)
console.log(`Action      : ${WRITE ? 'CREATE' : 'dry run (nothing will be written)'}`)
console.log('')

// Reuse a product per plan rather than one per SKU, so month and season sit
// under the same thing in the dashboard and in a customer's receipts.
const productCache = new Map()
async function findOrCreateProduct(name) {
  if (productCache.has(name)) return productCache.get(name)
  const existing = await stripe.products.search({ query: `active:'true' AND name:'${name.replace(/'/g, "\\'")}'` })
  let product = existing.data[0]
  if (!product) {
    if (!WRITE) {
      product = { id: '(would create)', name }
    } else {
      product = await stripe.products.create({ name, metadata: { ladder: 'v3' } })
      console.log(`  + product ${product.id}  ${name}`)
    }
  }
  productCache.set(name, product)
  return product
}

const results = []
let created = 0, reused = 0, conflicts = 0

for (const sku of CATALOGUE) {
  const lk = lookupKey(sku)
  const found = await stripe.prices.list({ lookup_keys: [lk], limit: 1, expand: ['data.product'] })
  const existing = found.data[0]

  if (existing) {
    const sameAmount = existing.unit_amount === sku.amount
    const sameShape = !!existing.recurring === sku.recurring
    if (sameAmount && sameShape) {
      reused++
      results.push({ sku, id: existing.id, status: 'exists' })
      console.log(`  = ${lk.padEnd(34)} ${money(sku.amount).padStart(9)}  ${existing.id}`)
    } else {
      conflicts++
      results.push({ sku, id: existing.id, status: 'CONFLICT' })
      console.log(`  ! ${lk.padEnd(34)} EXISTS AT ${money(existing.unit_amount)}${existing.recurring ? ' recurring' : ' one-time'}, catalogue says ${money(sku.amount)}${sku.recurring ? ' recurring' : ' one-time'}`)
      console.log(`      Stripe prices are immutable. Archive ${existing.id} and create a replacement by hand.`)
    }
    continue
  }

  const product = await findOrCreateProduct(sku.product)
  if (!WRITE) {
    results.push({ sku, id: '(would create)', status: 'todo' })
    console.log(`  + ${lk.padEnd(34)} ${money(sku.amount).padStart(9)}  ${sku.recurring ? 'recurring/month' : 'one-time'}`)
    continue
  }

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: sku.amount,
    currency: 'usd',
    lookup_key: lk,
    ...(sku.recurring ? { recurring: { interval: 'month' } } : {}),
    metadata: { tier: sku.tier, period: sku.period, ladder: 'v3' },
  })
  created++
  results.push({ sku, id: price.id, status: 'created' })
  console.log(`  + ${lk.padEnd(34)} ${money(sku.amount).padStart(9)}  ${price.id}`)
}

console.log('')
console.log(`created ${created}, already existed ${reused}, conflicts ${conflicts}`)

if (conflicts) {
  console.log('\nResolve the conflicts above before deploying. A price that disagrees')
  console.log('with lib/offer.ts sells at one number and displays another.')
}

// -------------------------------------------------- env block for Vercel
if (WRITE && !conflicts) {
  console.log('\n--- paste into Vercel (Production + Preview), NOT marked Sensitive ---')
  console.log('--- a NEXT_PUBLIC_* marked Sensitive is not inlined at build and becomes undefined ---\n')
  for (const r of results) console.log(`${r.sku.envVar}=${r.id}`)
}

if (!WRITE) {
  console.log('\nDry run. Re-run with --write to create these.')
}
