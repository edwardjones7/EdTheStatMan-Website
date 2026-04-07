import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_MODEL_PICKS } from '@/lib/site-content'
import type { ModelPicksContent } from '@/lib/site-content'
import type { TodaysBet } from '@/components/TodaysBets'
import ModelPicksPage from '@/components/ModelPicksPage'
import ModelPicksEditor from '@/components/ModelPicksEditor'

export const metadata: Metadata = {
  title: 'Model Picks – EdTheStatMan.com',
  description: 'Daily betting picks from EdTheStatMan. Active plays updated daily with full transparency.',
  alternates: { canonical: 'https://edthestatman.com/model-picks' },
  openGraph: {
    title: 'Model Picks – EdTheStatMan.com',
    description: 'Daily betting picks from EdTheStatMan. Active plays updated daily with full transparency.',
    url: 'https://edthestatman.com/model-picks',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
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

  const todaysBets: TodaysBet[] = betsResult.data ?? []
  const headerContent: ModelPicksContent = {
    ...DEFAULT_MODEL_PICKS,
    ...(contentResult.data?.value as object ?? {}),
  }

  let isAdmin = false
  let userTier: string | null = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('is_admin, subscription_tier, access_expires_at')
      .eq('id', user.id)
      .single()
    if ((profile as any)?.is_admin) {
      isAdmin = true
      userTier = 'premium'
    } else {
      userTier = (profile as any)?.subscription_tier ?? 'free'
      if (userTier !== 'free') {
        const exp = (profile as any)?.access_expires_at ? new Date((profile as any).access_expires_at) : null
        if (!exp || exp < new Date()) userTier = 'free'
      }
    }
  }

  return isAdmin ? (
    <ModelPicksEditor rows={todaysBets} userTier={userTier} headerContent={headerContent} />
  ) : (
    <ModelPicksPage rows={todaysBets} isAdmin={false} userTier={userTier} headerContent={headerContent} />
  )
}
