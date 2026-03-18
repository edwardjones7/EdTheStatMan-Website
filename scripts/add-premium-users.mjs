// Add specific premium users manually
// Run: node scripts/add-premium-users.mjs
//
// Creates users in Supabase with email pre-confirmed (no password — they use forgot-password).
// Sets premium tier + expiry on their profile.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '../.env.local') })
dotenv.config({ path: join(__dirname, '../.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  {
    email: 'dylanodonnell09@hotmail.com',
    full_name: "Dylan O'Donnell",
    expires_at: '2026-10-31T23:59:59Z',
  },
  {
    email: 'dogbiter100@gmail.com',
    full_name: 'Michael Surma',
    expires_at: '2026-05-11T23:59:59Z',
  },
]

console.log(`\nAdding ${USERS.length} premium users...`)
console.log('─'.repeat(60))

for (const user of USERS) {
  // 1. Create auth user
  const { data, error: createError } = await supabase.auth.admin.createUser({
    email: user.email,
    email_confirm: true,
    user_metadata: { full_name: user.full_name },
  })

  if (createError) {
    const msg = createError.message ?? ''
    if (msg.includes('already been registered') || msg.includes('already exists') || msg.includes('duplicate')) {
      console.log(`  EXISTS: ${user.email} — updating profile only`)
    } else {
      console.error(`  ERROR creating ${user.email}: ${msg}`)
      continue
    }
  } else {
    console.log(`  CREATED: ${user.email}`)
  }

  // 2. Look up the user's ID (works whether just created or already existed)
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error(`  ERROR fetching users: ${listError.message}`)
    continue
  }

  const authUser = users.find(u => u.email?.toLowerCase() === user.email.toLowerCase())
  if (!authUser) {
    console.error(`  ERROR: could not find user after create — ${user.email}`)
    continue
  }

  // 3. Upsert profile with premium tier + expiry
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authUser.id,
      email: user.email,
      full_name: user.full_name,
      subscription_tier: 'premium',
      subscription_status: 'active',
      access_expires_at: user.expires_at,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  if (profileError) {
    console.error(`  ERROR updating profile for ${user.email}: ${profileError.message}`)
  } else {
    console.log(`  PROFILE SET: premium until ${user.expires_at}`)
  }
}

console.log('\n' + '─'.repeat(60))
console.log('Done. Users can log in via forgot-password to set their password.')
