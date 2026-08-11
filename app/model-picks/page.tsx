import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_MODEL_PICKS } from '@/lib/site-content'
import type { ModelPicksContent } from '@/lib/site-content'
import type { TodaysBet } from '@/components/TodaysBets'
import ModelPicksPage from '@/components/ModelPicksPage'
import ModelPicksEditor from '@/components/ModelPicksEditor'
import { resolveAccess, ACCESS_SELECT } from '@/lib/access'
import { toBetTeaser, BET_TEASER_LIMIT } from '@/lib/teaser'
import type { LockedBetTeaser } from '@/lib/teaser'

export const metadata: Metadata = {
  title: 'EdTheStatBot Picks – EdTheStatMan.com',
  description: 'Daily betting picks from EdTheStatMan. Active plays updated daily with full transparency.',
  alternates: { canonical: 'https://edthestatman.com/model-picks' },
  openGraph: {
    title: 'EdTheStatBot Picks – EdTheStatMan.com',
    description: 'Daily betting picks from EdTheStatMan. Active plays updated daily with full transparency.',
    url: 'https://edthestatman.com/model-picks',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
}

export const dynamic = 'force-dynamic'

export default async function ModelPicks() {
  const supabase = await createClient()
  const adminDb = createAdminClient()

  const [betsResult, contentResult] = await Promise.all([
    (adminDb as any).from('todays_bets').select('*').order('created_at', { ascending: false }),
    (supabase as any).from('site_content').select('value').eq('key', 'model_picks').single(),
  ])

  const allBets: TodaysBet[] = betsResult.data ?? []
  const headerContent: ModelPicksContent = {
    ...DEFAULT_MODEL_PICKS,
    ...(contentResult.data?.value as object ?? {}),
  }

  const { data: { user } } = await supabase.auth.getUser()
  let access = resolveAccess(null, false)
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select(ACCESS_SELECT)
      .eq('id', user.id)
      .single()
    access = resolveAccess(profile as any, true)
  }
  const { tier: userTier, isAdmin, isPaid, hasElite } = access

  const isMember = isAdmin || isPaid

  // Edge picks (is_elite) sit a tier above members: they reach the client in
  // full only for elite members, and everyone else gets redacted stand-ins.
  const edgeBets = allBets.filter(b => b.is_elite)
  const regularBets = allBets.filter(b => !b.is_elite)

  // One list, one gate. `is_free` is purely an admin per-pick switch: free picks
  // render inline for everyone, the rest are dropped server-side and advertised
  // only as a count. The count mirrors TodaysBets' own `!show_on_results`
  // filter so it matches what a member would actually see in the table.
  const todaysBets = [
    ...(hasElite ? edgeBets : []),
    ...(isMember ? regularBets : regularBets.filter(b => b.is_free)),
  ]
  const lockedBetRows = isMember
    ? []
    : regularBets.filter(b => !b.is_free && !b.show_on_results)
  const lockedCount = lockedBetRows.length

  // Locked picks still occupy a row so the table reads as a real slate — but
  // toBetTeaser() copies fields explicitly, so the pick itself, its line, vig,
  // opponent and note never leave the server. The query orders by created_at
  // desc, so slicing here keeps the most recent picks.
  const lockedBets: LockedBetTeaser[] = lockedBetRows
    .slice(0, BET_TEASER_LIMIT)
    .map(toBetTeaser)

  // Edge picks withheld from everyone below elite — members included.
  const eliteLockedBets: LockedBetTeaser[] = hasElite
    ? []
    : edgeBets
        .filter(b => !b.show_on_results)
        .slice(0, BET_TEASER_LIMIT)
        .map(toBetTeaser)

  return isAdmin ? (
    <ModelPicksEditor rows={todaysBets} userTier={userTier} headerContent={headerContent} />
  ) : (
    <ModelPicksPage
      rows={todaysBets}
      isAdmin={false}
      userTier={userTier}
      isMember={isMember}
      lockedCount={lockedCount}
      lockedBets={lockedBets}
      eliteLockedBets={eliteLockedBets}
      headerContent={headerContent}
    />
  )
}
