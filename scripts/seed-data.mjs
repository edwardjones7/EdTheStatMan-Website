// Seed betting_systems and betting_trends from data/sample data.xlsx
// Run: node scripts/seed-data.mjs
// Requires: npm install --save-dev xlsx @supabase/supabase-js dotenv

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { read as xlsxRead, utils } from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const __dirname = dirname(fileURLToPath(import.meta.url))
const xlsxPath = join(__dirname, '..', 'data', 'sample data.xlsx')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

// Sheet index → { table, sport, is_free }
const SHEET_MAP = [
  { table: 'betting_systems', sport: 'cbb', is_free: false },  // Sheet 1: NCAA Tournament Member Systems
  { table: 'betting_systems', sport: 'cbb', is_free: true },   // Sheet 2: NCAA Tournament Free Systems
  { table: 'betting_trends',  sport: 'cbb', is_free: false },  // Sheet 3: NCAA Tournament Member Trends
  { table: 'betting_trends',  sport: 'cbb', is_free: true },   // Sheet 4: NCAA Tournament Free Trends
]

function parseNum(val) {
  if (val === undefined || val === null || val === '') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

function parseInt(val) {
  const n = parseNum(val)
  return n === null ? 0 : Math.round(n)
}

function parseStr(val) {
  if (val === undefined || val === null) return ''
  return String(val).trim()
}

async function seedSheet(wb, sheetIndex, config) {
  const sheetName = wb.SheetNames[sheetIndex]
  if (!sheetName) {
    console.warn(`Sheet index ${sheetIndex} not found — skipping`)
    return
  }
  const ws = wb.Sheets[sheetName]
  const rows = utils.sheet_to_json(ws, { defval: '' })

  console.log(`\nSheet "${sheetName}" (${rows.length} rows) → ${config.table} [sport=${config.sport}, is_free=${config.is_free}]`)

  if (rows.length === 0) {
    console.log('  No rows to insert.')
    return
  }

  const records = rows.map((row, i) => ({
    sport: config.sport,
    description: parseStr(row['description'] ?? row['Description'] ?? row['DESCRIPTION'] ?? row['rule'] ?? row['Rule'] ?? ''),
    line: parseStr(row['line'] ?? row['Line'] ?? row['LINE'] ?? ''),
    season: parseStr(row['season'] ?? row['Season'] ?? row['SEASON'] ?? ''),
    pct: parseNum(row['pct'] ?? row['Pct'] ?? row['PCT'] ?? row['pct%'] ?? row['Pct%'] ?? ''),
    units: parseNum(row['units'] ?? row['Units'] ?? row['UNITS'] ?? ''),
    type: parseStr(row['type'] ?? row['Type'] ?? row['TYPE'] ?? ''),
    w: parseInt(row['w'] ?? row['W'] ?? row['wins'] ?? row['Wins'] ?? 0),
    l: parseInt(row['l'] ?? row['L'] ?? row['losses'] ?? row['Losses'] ?? 0),
    t: parseInt(row['t'] ?? row['T'] ?? row['ties'] ?? row['Ties'] ?? 0),
    is_free: config.is_free,
    is_active: true,
    sort_order: i,
  }))

  const { error } = await supabase.from(config.table).insert(records)
  if (error) {
    console.error(`  ERROR inserting into ${config.table}:`, error.message)
  } else {
    console.log(`  Inserted ${records.length} rows into ${config.table}.`)
  }
}

async function main() {
  console.log(`Reading: ${xlsxPath}`)
  const buf = readFileSync(xlsxPath)
  const wb = xlsxRead(buf, { type: 'buffer' })
  console.log(`Sheets found: ${wb.SheetNames.join(', ')}`)

  for (let i = 0; i < SHEET_MAP.length; i++) {
    await seedSheet(wb, i, SHEET_MAP[i])
  }

  console.log('\nDone.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
