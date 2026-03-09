import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import BlogFilter from '@/components/BlogFilter'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { BlogPost } from '@/components/BlogFilter'

export const metadata: Metadata = {
  title: 'Blog & Insights – EdTheStatMan.com',
  description: 'Expert analysis, betting system breakdowns, and educational content for sports bettors. NFL, NBA, college football & basketball insights.',
  openGraph: {
    title: 'Blog & Insights – EdTheStatMan.com',
    description: 'Expert analysis, betting system breakdowns, and educational content for sports bettors.',
  },
}

export default async function Blog() {
  const admin = createAdminClient()
  const supabase = await createClient()

  const [{ data: posts }, { data: { session } }] = await Promise.all([
    admin
      .from('posts')
      .select('id, title, slug, excerpt, tag, access_level, published_at')
      .eq('published', true)
      .order('published_at', { ascending: false }),
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

  return (
    <main>
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">EdTheStatMan</span>
            <h1 className="page-header__title">Blog &amp; Insights</h1>
            <p className="page-header__subtitle">Expert analysis, system breakdowns, and educational content to sharpen your handicapping edge.</p>
          </div>
        </div>
      </header>

      <section className="section">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Latest Articles</span>
            <h2 className="section-title">Featured <span className="text-gradient">Content</span></h2>
            <p className="section-subtitle">Filter by sport to find the insights that matter most to you.</p>
          </div>
          <BlogFilter posts={(posts ?? []) as BlogPost[]} userTier={userTier} />
        </div>
      </section>

      <CTASection />
    </main>
  )
}
