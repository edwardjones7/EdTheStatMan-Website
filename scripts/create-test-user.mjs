/**
 * Create (or delete) a pre-confirmed test user for the payment rehearsal.
 *
 *   node scripts/create-test-user.mjs <email> <password>
 *   node scripts/create-test-user.mjs <email> --delete
 *
 * WHY THIS EXISTS. Signing up through the UI sends a Supabase confirmation
 * email, and that delivery currently fails with "Error sending confirmation
 * email". `auth.admin.createUser({ email_confirm: true })` creates the account
 * already confirmed and sends nothing, so the rehearsal does not depend on mail
 * working at all.
 *
 * ⚠️ THIS WRITES TO THE PRODUCTION SUPABASE PROJECT. `.env.local` points there
 * and there is no second database. That is why the guard below refuses any
 * address that does not look like a throwaway: creating or, far worse,
 * DELETING a real member here is a single typo away.
 *
 * See docs/TESTING-PAYMENTS.md for where this fits, and for the cleanup SQL.
 */

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

const [, , email, second] = process.argv
const DELETE = second === '--delete'
const password = DELETE ? null : second

if (!email || !second) {
  console.error('Usage: node scripts/create-test-user.mjs <email> <password|--delete>')
  process.exit(1)
}

// The guard. A test address has a + tag or an obvious test/example domain.
// Everything else is assumed to be a real member and refused.
const looksLikeTest =
  /\+/.test(email) || /@(example\.(com|org)|test\.local|mailinator\.com)$/i.test(email)
if (!looksLikeTest) {
  console.error(
    `Refusing to touch "${email}" -- it does not look like a throwaway.\n` +
    'Use a +tag address (you+test1@gmail.com) or an example.com address.\n' +
    'This script talks to the PRODUCTION database.'
  )
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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// admin.listUsers is paginated and this project has ~180 users, so one page is
// plenty; bump perPage rather than assuming the default covers it.
async function findByEmail(addr) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(error.message)
  return data.users.find(u => u.email?.toLowerCase() === addr.toLowerCase()) ?? null
}

const existing = await findByEmail(email)

if (DELETE) {
  if (!existing) {
    console.log(`No user ${email}. Nothing to delete.`)
    process.exit(0)
  }
  // profiles rows cascade from auth.users, and purchases/stripe_events do not
  // -- clear those with the SQL in docs/TESTING-PAYMENTS.md BEFORE this, while
  // the user id is still resolvable.
  const { error } = await admin.auth.admin.deleteUser(existing.id)
  if (error) { console.error(error.message); process.exit(1) }
  console.log(`Deleted ${email} (${existing.id}).`)
  process.exit(0)
}

if (existing) {
  console.log(`${email} already exists: ${existing.id}`)
  console.log(`confirmed: ${!!existing.email_confirmed_at}`)
  process.exit(0)
}

const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,   // already confirmed -- no mail is sent
})
if (error) { console.error(error.message); process.exit(1) }

console.log(`Created ${email}`)
console.log(`user id: ${data.user.id}`)
console.log('Confirmed, no email sent. Sign in at http://localhost:3000/login')
