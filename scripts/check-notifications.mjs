/**
 * Preflight for the pick-notification pipeline.
 *
 *   node scripts/check-notifications.mjs                      # audit only, SENDS NOTHING
 *   node scripts/check-notifications.mjs --discord            # + one test post to Discord
 *   node scripts/check-notifications.mjs --email you@x.com    # + one test email, ONE address
 *
 * WHY THIS EXISTS. Notifications fire automatically on every pick insert, to
 * Discord, email and web push at once, with no confirmation step -- `notify:false`
 * on the request body is the only suppression. So the moment you find out the
 * config is wrong is normally the moment you have already sent 176 people a
 * broken link, or sent them nothing and not known.
 *
 * The audit is READ-ONLY. It never inserts a pick and never sends unless you
 * pass a flag. `--discord` posts to the real channel your members can see;
 * `--email` refuses more than one address, on purpose.
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2)
const DO_DISCORD = argv.includes('--discord')
const emailIdx = argv.indexOf('--email')
const EMAIL_TO = emailIdx >= 0 ? argv[emailIdx + 1] : null

if (emailIdx >= 0 && (!EMAIL_TO || EMAIL_TO.startsWith('--') || EMAIL_TO.includes(','))) {
  console.error('--email takes exactly ONE address. Refusing.')
  process.exit(1)
}

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

const ok = (b) => (b ? 'OK  ' : 'MISS')
let problems = []

console.log('\n--- configuration -------------------------------------------------')
const need = [
  ['DISCORD_WEBHOOK_URL', true],
  ['DISCORD_MEMBERS_ROLE_ID', true],
  // Optional: without it a free pick still posts, just with no @role mention.
  ['DISCORD_FREE_ROLE_ID', false],
  ['RESEND_API_KEY', true],
  ['NEXT_PUBLIC_VAPID_PUBLIC_KEY', true],
  ['VAPID_PRIVATE_KEY', true],
  ['VAPID_SUBJECT', true],
  ['NEXT_PUBLIC_SITE_URL', true],
]
for (const [k, required] of need) {
  const present = !!env[k]
  console.log(`  ${ok(present)}  ${k}${required ? '' : '   (optional)'}`)
  if (!present && required) problems.push(`${k} is not set`)
  if (!present && !required) console.log(`        -> free-audience Discord posts will carry no @role mention`)
}

const killed = env.NOTIFICATIONS_ENABLED === 'false'
console.log(`  ${killed ? 'OFF ' : 'ON  '}  NOTIFICATIONS_ENABLED=${JSON.stringify(env.NOTIFICATIONS_ENABLED ?? '(unset)')}`)
if (killed) problems.push('NOTIFICATIONS_ENABLED=false — every channel is silenced')

console.log(`\n  SITE_URL used in every notification link: ${env.NEXT_PUBLIC_SITE_URL}`)
if ((env.NEXT_PUBLIC_SITE_URL ?? '').includes('localhost')) {
  problems.push('NEXT_PUBLIC_SITE_URL points at localhost — links in sent mail will be dead for recipients')
}

console.log('\n--- Discord -------------------------------------------------------')
try {
  // GET returns the webhook's metadata and sends nothing.
  const r = await fetch(env.DISCORD_WEBHOOK_URL)
  if (r.ok) {
    const j = await r.json()
    console.log(`  OK    webhook live, channel "${j.name}"`)
  } else {
    console.log(`  FAIL  webhook returned ${r.status} — revoked or wrong URL`)
    problems.push('Discord webhook is not valid')
  }
} catch (e) {
  console.log('  FAIL  ' + e.message)
  problems.push('Discord webhook unreachable')
}

console.log('\n--- Resend --------------------------------------------------------')
try {
  const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY } })
  if (r.ok) {
    const j = await r.json()
    for (const d of j.data ?? []) {
      const good = d.status === 'verified' && d.capabilities?.sending === 'enabled'
      console.log(`  ${ok(good)}  ${d.name} — ${d.status}, sending ${d.capabilities?.sending}`)
      if (!good) problems.push(`Resend domain ${d.name} cannot send`)
    }
    if (!(j.data ?? []).length) problems.push('Resend has no domains')
  } else {
    console.log(`  FAIL  key rejected (${r.status})`)
    problems.push('Resend API key is invalid')
  }
} catch (e) { console.log('  FAIL  ' + e.message); problems.push('Resend unreachable') }

console.log('\n--- audience ------------------------------------------------------')
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data: profiles } = await db.from('profiles')
  .select('email, notify_email, notify_token, subscription_tier, access_expires_at, is_admin')
const now = Date.now()
const paid = r => r.is_admin || (r.access_expires_at && new Date(r.access_expires_at).getTime() > now && r.subscription_tier !== 'retail')
const mailable = (profiles ?? []).filter(r => r.email && r.notify_email !== false)
console.log(`  a FREE pick emails      ${mailable.length} people`)
console.log(`  a MEMBERS pick emails   ${mailable.filter(paid).length} people`)
console.log(`  opted out               ${(profiles ?? []).filter(r => r.notify_email === false).length}`)
const noTok = (profiles ?? []).filter(r => r.email && !r.notify_token).length
console.log(`  ${ok(noTok === 0)}  every recipient has a notify_token (unsubscribe link)`)
if (noTok) problems.push(`${noTok} profiles have no notify_token — their unsubscribe link will not work`)

const { count: pushCount } = await db.from('push_subscriptions').select('*', { count: 'exact', head: true })
console.log(`  web push subscriptions  ${pushCount}`)

console.log('\n--- reach per rung ------------------------------------------------')
// Notifications now use the ladder predicate the site gates with: a pick at
// rung R reaches everyone at R or above, because the ladder is inclusive.
const RANK = { retail: 0, portfolio: 1, desk: 2, private: 3, institutional: 4 }
const LEGACY = { free: 'retail', basic: 'desk', premium: 'private', elite: 'institutional' }
const norm = v => (v in RANK ? v : LEGACY[v] ?? 'retail')
const tierOf = r => {
  if (r.is_admin) return 'institutional'
  const live = r.access_expires_at && new Date(r.access_expires_at).getTime() > now
  return live ? norm(r.subscription_tier) : 'retail'
}
for (const rung of Object.keys(RANK)) {
  const n = mailable.filter(r => RANK[tierOf(r)] >= RANK[rung]).length
  console.log(`  a ${(rung + "            ").slice(0, 14)} pick emails ${n} people`)
}

const { data: bets } = await db.from('todays_bets').select('min_tier')
const counts = {}
for (const bet of bets ?? []) counts[bet.min_tier ?? '(null)'] = (counts[bet.min_tier ?? '(null)'] ?? 0) + 1
console.log('  picks by rung:', JSON.stringify(counts))
for (const [t, n] of Object.entries(counts)) {
  if (n > 0 && mailable.filter(r => RANK[tierOf(r)] >= RANK[t]).length === 0) {
    problems.push(`${n} picks at "${t}" would reach nobody by email — no member holds that rung`)
  }
}

console.log('\n--- optional sends ------------------------------------------------')
if (DO_DISCORD) {
  const r = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'Notification preflight — ignore. Sent by scripts/check-notifications.mjs.' }),
  })
  console.log(`  Discord test post -> ${r.status} ${r.ok ? '(check the channel)' : await r.text()}`)
} else console.log('  Discord: not sent (pass --discord)')

if (EMAIL_TO) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'EdTheStatMan <noreply@edthestatman.com>',
      to: [EMAIL_TO],
      subject: 'Notification preflight',
      text: `If you are reading this, Resend sending works.\n\nLinks in real notifications point at ${env.NEXT_PUBLIC_SITE_URL}/portfolio`,
    }),
  })
  console.log(`  Email to ${EMAIL_TO} -> ${r.status} ${r.ok ? '' : await r.text()}`)
} else console.log('  Email: not sent (pass --email <one address>)')

console.log('\n--- verdict -------------------------------------------------------')
if (!problems.length) console.log('  No problems found.\n')
else { console.log('  ' + problems.length + ' to look at:'); problems.forEach(p => console.log('   - ' + p)); console.log('') }
