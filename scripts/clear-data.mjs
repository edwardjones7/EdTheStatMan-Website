import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const { error: e1 } = await supabase.from('betting_systems').delete().gte('sort_order', -999999)
if (e1) { console.error('systems:', e1.message); process.exit(1) }
console.log('✓ betting_systems cleared')

const { error: e2 } = await supabase.from('betting_trends').delete().gte('sort_order', -999999)
if (e2) { console.error('trends:', e2.message); process.exit(1) }
console.log('✓ betting_trends cleared')
