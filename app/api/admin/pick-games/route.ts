import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { candidateGames, deskSportOfPick, matchGame } from '@/lib/picks/game-match'

/**
 * The games a pick could be on, for the "Game" picker in the admin pick
 * editor, plus which one auto-match would choose for the text typed so far.
 *
 * GET ?sport=NFL&date=2026-11-02&bet=Bears%20%2B1.5&opponent=
 */
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const admin = createAdminClient() as any
  const { data: p } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!p?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = new URL(req.url).searchParams
  const pick = {
    sport: q.get('sport'),
    date: q.get('date'),
    bet: q.get('bet'),
    opponent: q.get('opponent'),
  }
  if (!deskSportOfPick(pick.sport) || !pick.date) return NextResponse.json({ games: [], suggested: null })

  const games = await candidateGames(admin, pick)
  return NextResponse.json({
    games: games.map(g => ({
      id: g.id,
      label: `${g.away_abbrev} @ ${g.home_abbrev}`,
      kickoff: g.kickoff,
    })),
    suggested: matchGame(pick, games),
  })
}
