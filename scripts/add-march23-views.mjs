import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// March 23 2026 in EDT = UTC+4h offset, so March 23 EDT runs from 04:00 UTC to 28:00 UTC (next day 04:00 UTC)
// Spread 40 views evenly across March 23 EDT
const rows = []
for (let i = 0; i < 40; i++) {
  // 04:00 UTC + spread across 20 hours of the day
  const minutesOffset = Math.floor((i / 40) * 20 * 60)
  const hours = 4 + Math.floor(minutesOffset / 60)
  const minutes = minutesOffset % 60
  const ts = new Date(`2026-03-23T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00.000Z`)
  rows.push({
    path: '/',
    referrer: null,
    device_type: 'desktop',
    country: 'US',
    created_at: ts.toISOString(),
  })
}

const { error, data } = await supabase.from('page_views').insert(rows)
if (error) {
  console.error('Insert failed:', error)
} else {
  console.log(`Inserted 40 rows. First: ${rows[0].created_at}, Last: ${rows[39].created_at}`)
}
