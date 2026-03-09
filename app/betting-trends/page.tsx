import type { Metadata } from 'next'
import Link from 'next/link'
import CTASection from '@/components/CTASection'
import TrendsFilter from '@/components/TrendsFilter'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata: Metadata = {
  title: 'Betting Trends – EdTheStatMan.com',
  description: 'Team-by-team betting trends for NFL, NBA, College Football, and College Basketball. ATS records, over/under patterns, and situational edges.',
  openGraph: {
    title: 'Betting Trends – EdTheStatMan.com',
    description: 'Team-by-team betting trends for NFL, NBA, College Football, and College Basketball. ATS records, over/under patterns, and situational edges.',
  },
}

export default async function BettingTrends() {
  const admin = createAdminClient()
  const supabase = await createClient()
  const [{ data: trends }, { data: { session } }] = await Promise.all([
    (admin as any).from('betting_trends').select('*').order('sport').order('sort_order', { ascending: true }),
    supabase.auth.getSession(),
  ])

  let userTier: string | null = null
  if (session) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('subscription_tier, subscription_status, is_admin')
      .eq('id', session.user.id)
      .single()
    if ((profile as any)?.is_admin) {
      userTier = 'premium'
    } else {
      userTier = (profile as any)?.subscription_tier ?? 'free'
      if (userTier !== 'free' && (profile as any)?.subscription_status !== 'active') {
        userTier = 'free'
      }
    }
  }

  const isPaid = userTier === 'basic' || userTier === 'premium'

  return (
    <main>
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Team-by-Team Analysis</span>
            <h1 className="page-header__title">Betting Trends</h1>
            <p className="page-header__subtitle">ATS records, over/under patterns, home/away splits, and situational trends for every team across NFL, College Football, NBA, and College Basketball.</p>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Explore Trends</span>
            <h2 className="section-title">Team Betting Trends</h2>
            <p className="section-subtitle">Filter by sport and search for teams to discover ATS and O/U patterns.</p>
          </div>
          <TrendsFilter trends={(trends ?? []) as any[]} userTier={userTier} />
        </div>
      </section>

      {!isPaid && (
        <section className="section" style={{ background: 'var(--bg-secondary)' }}>
          <div className="container">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <span className="section-label">Unlock Full Access</span>
              <h2 className="section-title">Get All <span className="text-gradient">15+ Trends</span> Per Team</h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>
                Members get unlimited access to every trend: situational splits, rest patterns, conference play, and more.
              </p>
            </div>

            <div className="cta-box reveal-scale" style={{ marginTop: '40px' }}>
              <h2 className="cta-box__title">
                Upgrade to Pro. <span className="text-gradient">Unlock Every Edge.</span>
              </h2>
              <p className="cta-box__text">
                Join Basic or Premium to access all betting trends, full betting systems, and Telegram alerts.
              </p>
              <div className="cta-box__actions">
                <Link href="/betting-systems#pricing" className="btn btn--primary btn--lg">
                  <span className="btn__icon">&#9889;</span> View Plans
                </Link>
                <Link href="/signup" className="btn btn--secondary btn--lg">
                  Create Free Account
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <CTASection />
    </main>
  )
}
