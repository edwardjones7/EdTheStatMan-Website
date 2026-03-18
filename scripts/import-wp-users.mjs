// Import WordPress users from data/wp5f_users.csv into Supabase
// Run: node scripts/import-wp-users.mjs
//
// Password handling:
//   $wp$2y$... → bcrypt (WordPress 6.8+) — strip $wp$ prefix, import hash directly (seamless)
//   $P$...     → phpass (MD5-based)      — import with confirmed email, send password reset email
//
// Requires env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SITE_URL

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local first (Next.js), fallback to .env
dotenv.config({ path: join(__dirname, '../.env.local') })
dotenv.config({ path: join(__dirname, '../.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://edthestatman.com'

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Parse CSV — handles quoted fields
function parseCSV(text) {
  const lines = text.trim().split('\n')
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, (values[i] ?? '').trim()]))
  })
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

const csvPath = join(__dirname, '../data/wp5f_users.csv')
const csv = readFileSync(csvPath, 'utf-8')
const rows = parseCSV(csv)

console.log(`\nFound ${rows.length} users in CSV`)
console.log('─'.repeat(60))

let imported = 0
let skipped = 0
let errors = 0
const resetNeeded = [] // emails of phpass users who need password reset

for (const row of rows) {
  const email = row.user_email?.toLowerCase().trim()

  if (!email || !email.includes('@') || !email.includes('.')) {
    console.log(`  SKIP  (bad email): "${row.user_email}"`)
    skipped++
    continue
  }

  const hash = row.user_pass?.trim() ?? ''
  const isBcrypt = hash.startsWith('$wp$')
  const isPhpass = hash.startsWith('$P$')

  const userData = {
    email,
    email_confirm: true,
    user_metadata: {
      display_name: row.display_name || row.user_login,
      username: row.user_login,
    },
  }

  if (isBcrypt) {
    // $wp$ prefix is WordPress-specific; strip it to get standard bcrypt ($2y$...)
    userData.password_hash = hash.slice(4)
  }
  // phpass: no password_hash — Supabase can't verify phpass natively
  // User will receive a reset email and set a new password

  const { error } = await supabase.auth.admin.createUser(userData)

  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('already been registered') || msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`  SKIP  (exists):    ${email}`)
      skipped++
    } else {
      console.error(`  ERROR:             ${email} — ${msg}`)
      errors++
    }
    continue
  }

  imported++

  if (isPhpass) {
    resetNeeded.push(email)
    console.log(`  OK    (reset email): ${email}`)
  } else if (isBcrypt) {
    console.log(`  OK    (bcrypt):      ${email}`)
  } else {
    console.log(`  OK    (no password): ${email}`)
  }
}

console.log('\n' + '─'.repeat(60))
console.log(`Imported:              ${imported}`)
console.log(`Skipped (dup/invalid): ${skipped}`)
console.log(`Errors:                ${errors}`)
console.log(`Need password reset:   ${resetNeeded.length}`)

if (resetNeeded.length > 0) {
  console.log('\nSending password reset emails to phpass users...')
  console.log('(They will receive an email to set a new password)\n')

  let sent = 0
  let failedResets = 0

  for (const email of resetNeeded) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    })
    if (error) {
      console.error(`  FAIL reset email: ${email} — ${error.message}`)
      failedResets++
    } else {
      sent++
    }
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100))
  }

  console.log(`\nReset emails sent: ${sent}`)
  if (failedResets > 0) console.log(`Failed to send:    ${failedResets}`)
}

console.log('\nDone.')
