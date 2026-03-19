// Seed today's picks into the todays_bets table
// Run: node scripts/seed-todays-bets.mjs

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

const supabase = createClient(supabaseUrl, serviceRoleKey)

const rows = [
  // --- Futures (show_on_results: false, is_free: false) ---
  { date: 'Mar 18', sport: 'NCAA', risk: '0.25%', bet: 'Florida to win it all', line: '+800',  win: '2%',     result: 'pending', note: 'Future', show_on_results: false, is_active: true, is_free: false },
  { date: 'Mar 18', sport: 'NCAA', risk: '0.25%', bet: 'Houston to win it all', line: '+1300', win: null,     result: 'pending', note: 'Future', show_on_results: false, is_active: true, is_free: false },
  { date: 'Mar 18', sport: 'NCAA', risk: '0.5%',  bet: 'Duke to win it all',   line: '+392',  win: null,     result: 'pending', note: 'Future', show_on_results: false, is_active: true, is_free: false },
  { date: 'Mar 18', sport: 'WTA',  risk: '0.25%', bet: 'Pegula to win Miami Open', line: '+1300', win: '3.25%', result: 'pending', note: 'Future', show_on_results: false, is_active: true, is_free: false },
  { date: 'Mar 18', sport: 'PGA',  risk: '0.13%', bet: 'Nick Taylor to win Valspar', line: '+5500', win: null, result: 'pending', note: 'Future', show_on_results: false, is_active: true, is_free: false },
  { date: 'Mar 18', sport: 'PGA',  risk: '0.13%', bet: 'Hovland to win Valspar', line: '+1950', win: null,   result: 'pending', note: 'Future', show_on_results: false, is_active: true, is_free: false },
  { date: 'Mar 18', sport: 'PGA',  risk: '0.25%', bet: 'Taylor top 20',         line: '+201',  win: null,   result: 'pending', note: 'Future', show_on_results: false, is_active: true, is_free: false },
  { date: 'Mar 18', sport: 'PGA',  risk: '0.28%', bet: 'Hovland top 20',        line: '-106',  win: null,   result: 'pending', note: 'Future', show_on_results: false, is_active: true, is_free: false },

  // --- Today's Picks (is_free: true) ---
  { date: 'Mar 18', sport: 'CBB', risk: '1.11%', bet: 'Lehigh -3.5',   line: '-108',  win: '1.03%', result: 'pending', note: null,   show_on_results: true, is_active: true, is_free: true },
  { date: 'Mar 18', sport: 'WTA', risk: '1.11%', bet: 'Kalieva',       line: '+130',  win: '1.44%', result: 'pending', note: null,   show_on_results: true, is_active: true, is_free: true },
  { date: 'Mar 18', sport: 'NBA', risk: '0.45%', bet: 'Jazz +13',      line: '-105',  win: '0.43%', result: 'pending', note: null,   show_on_results: true, is_active: true, is_free: true },
  { date: 'Mar 18', sport: 'NBA', risk: '0.28%', bet: 'Pelicans +2.5', line: null,    win: '0.25%', result: 'pending', note: null,   show_on_results: true, is_active: true, is_free: true },
  { date: 'Mar 18', sport: 'NBA', risk: '1.11%', bet: 'Rockets -2',    line: '-105',  win: '1.06%', result: 'pending', note: null,   show_on_results: true, is_active: true, is_free: true },
  { date: 'Mar 18', sport: 'CBB', risk: '0.55%', bet: 'Lehigh +6.5',   line: null,    win: '0.5%',  result: 'pending', note: 'Live', show_on_results: true, is_active: true, is_free: true },
  { date: 'Mar 18', sport: 'NBA', risk: '0.28%', bet: 'Jazz +21.5',    line: '-105',  win: '0.27%', result: 'pending', note: 'Live', show_on_results: true, is_active: true, is_free: true },
  { date: 'Mar 18', sport: 'CBB', risk: '0.5%',  bet: 'SMU',           line: '+150',  win: '0.75%', result: 'pending', note: 'Live', show_on_results: true, is_active: true, is_free: true },
  { date: 'Mar 18', sport: 'NBA', risk: '0.68%', bet: 'Rockets +7.5',  line: null,    win: '0.62%', result: 'pending', note: 'Live', show_on_results: true, is_active: true, is_free: true },
]

const { data, error } = await supabase.from('todays_bets').insert(rows).select()

if (error) {
  console.error('Insert failed:', error.message)
  process.exit(1)
}

console.log(`Inserted ${data.length} rows successfully.`)
data.forEach(r => console.log(`  [${r.id}] ${r.sport} | ${r.bet}`))
