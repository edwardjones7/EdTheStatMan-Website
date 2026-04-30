import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'
import BlogFilter from '@/components/BlogFilter'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { BlogPost } from '@/components/BlogFilter'

export const metadata: Metadata = {
  title: 'Blog & Insights',
  description: 'Expert analysis, betting system breakdowns, and educational content for sports bettors. NFL, NBA, college football & basketball insights.',
  alternates: { canonical: 'https://edthestatman.com/blog' },
  openGraph: {
    title: 'Blog & Insights – EdTheStatMan.com',
    description: 'Expert analysis, betting system breakdowns, and educational content for sports bettors. NFL, NBA, college football & basketball insights.',
    url: 'https://edthestatman.com/blog',
    images: [{ url: '/opengraph-image', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog & Insights – EdTheStatMan.com',
    description: 'Expert analysis, betting system breakdowns, and educational content for sports bettors.',
    images: ['/opengraph-image'],
  },
}

export default async function Blog() {
  const admin = createAdminClient()
  const supabase = await createClient()

  const [{ data: posts }, { data: { user } }] = await Promise.all([
    admin
      .from('posts')
      .select('id, title, slug, excerpt, tag, access_level, published_at')
      .eq('published', true)
      .order('published_at', { ascending: false }),
    supabase.auth.getUser(),
  ])

  let userTier: string | null = null
  if (user) {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('subscription_tier, subscription_status, is_admin')
      .eq('id', user.id)
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
      <section className="section" style={{ paddingTop: 'calc(var(--nav-height) + 100px)' }}>
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
