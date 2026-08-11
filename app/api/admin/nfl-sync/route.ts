import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildGameSlug } from '@/lib/nfl'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const }
  const admin = createAdminClient()
  const { data: p } = await (admin as any).from('profiles').select('is_admin').eq('id', user.id).single()
  return { ok: !!p?.is_admin as boolean, admin: admin as any }
}

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

interface ParsedGame {
  espn_event_id: string
  season: number
  season_type: number
  week: number
  kickoff: string | null
  status: string
  home_team: string
  home_abbrev: string
  away_team: string
  away_abbrev: string
  home_score: number | null
  away_score: number | null
}

// ESPN's API is unofficial and unversioned — parse defensively and skip any
// event that doesn't match the expected shape rather than failing the run.
function parseEvents(json: any, season: number, seasonType: number, week: number): { games: ParsedGame[]; failed: string[] } {
  const games: ParsedGame[] = []
  const failed: string[] = []
  for (const event of json?.events ?? []) {
    try {
      const comp = event?.competitions?.[0]
      const competitors = comp?.competitors ?? []
      const home = competitors.find((c: any) => c.homeAway === 'home')
      const away = competitors.find((c: any) => c.homeAway === 'away')
      if (!event?.id || !home?.team?.abbreviation || !away?.team?.abbreviation) {
        failed.push(String(event?.id ?? event?.name ?? 'unknown event'))
        continue
      }
      const scoreOf = (c: any) => {
        const n = Number(c?.score)
        return c?.score !== undefined && c?.score !== '' && !Number.isNaN(n) ? n : null
      }
      games.push({
        espn_event_id: String(event.id),
        season,
        season_type: seasonType,
        week: Number(event?.week?.number ?? week),
        kickoff: event?.date ? new Date(event.date).toISOString() : null,
        status: String(event?.status?.type?.state ?? 'pre'),
        home_team: String(home.team.displayName ?? home.team.abbreviation),
        home_abbrev: String(home.team.abbreviation),
        away_team: String(away.team.displayName ?? away.team.abbreviation),
        away_abbrev: String(away.team.abbreviation),
        home_score: scoreOf(home),
        away_score: scoreOf(away),
      })
    } catch {
      failed.push(String(event?.id ?? 'unknown event'))
    }
  }
  return { games, failed }
}

export async function POST(req: Request) {
  const { ok, admin } = await assertAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: any = {}
  try { body = await req.json() } catch { /* empty body = full-season sync */ }

  const season: number = Number(body.season) || new Date().getFullYear()
  // Default sweep: regular season weeks 1–18 plus postseason weeks 1–5.
  // Empty weeks (e.g. playoffs not yet scheduled) simply return no events.
  const targets: { seasonType: number; week: number }[] = []
  if (body.seasonType && body.week) {
    targets.push({ seasonType: Number(body.seasonType), week: Number(body.week) })
  } else {
    for (let w = 1; w <= 18; w++) targets.push({ seasonType: 2, week: w })
    for (let w = 1; w <= 5; w++) targets.push({ seasonType: 3, week: w })
  }

  const parsed: ParsedGame[] = []
  const failed: string[] = []

  for (const t of targets) {
    try {
      const url = `${ESPN_SCOREBOARD}?dates=${season}&seasontype=${t.seasonType}&week=${t.week}`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) { failed.push(`fetch ${t.seasonType}/${t.week}: HTTP ${res.status}`); continue }
      const json = await res.json()
      const out = parseEvents(json, season, t.seasonType, t.week)
      parsed.push(...out.games)
      failed.push(...out.failed)
    } catch (e: any) {
      failed.push(`fetch ${t.seasonType}/${t.week}: ${e?.message ?? 'error'}`)
    }
  }

  if (parsed.length === 0) {
    return NextResponse.json({ inserted: 0, updated: 0, failed, error: 'No games parsed from ESPN.' }, { status: 502 })
  }

  const { data: existingRows, error: readError } = await admin
    .from('nfl_games')
    .select('espn_event_id')
    .in('espn_event_id', parsed.map(g => g.espn_event_id))
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })
  const existingIds = new Set((existingRows ?? []).map((r: any) => r.espn_event_id))

  // Split insert vs update so admin-owned columns (slug, brief, writeup_html,
  // is_published, links) are never touched by a sync. Slugs are frozen at
  // insert for SEO stability even if ESPN later changes an abbreviation.
  const toInsert = parsed
    .filter(g => !existingIds.has(g.espn_event_id))
    .map(g => ({ ...g, slug: buildGameSlug(g.season, g.season_type, g.week, g.away_abbrev, g.home_abbrev) }))
  const toUpdate = parsed.filter(g => existingIds.has(g.espn_event_id))

  let inserted = 0
  if (toInsert.length > 0) {
    const { error } = await admin.from('nfl_games').insert(toInsert)
    if (error) return NextResponse.json({ error: error.message, inserted, failed }, { status: 500 })
    inserted = toInsert.length
  }

  let updated = 0
  for (const g of toUpdate) {
    const { error } = await admin
      .from('nfl_games')
      .update({
        season: g.season,
        season_type: g.season_type,
        week: g.week,
        kickoff: g.kickoff,
        status: g.status,
        home_team: g.home_team,
        home_abbrev: g.home_abbrev,
        away_team: g.away_team,
        away_abbrev: g.away_abbrev,
        home_score: g.home_score,
        away_score: g.away_score,
      })
      .eq('espn_event_id', g.espn_event_id)
    if (error) failed.push(`update ${g.espn_event_id}: ${error.message}`)
    else updated++
  }

  return NextResponse.json({ inserted, updated, failed })
}
