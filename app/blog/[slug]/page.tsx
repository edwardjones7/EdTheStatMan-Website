import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const admin = createAdminClient()
  const { data: post } = await admin
    .from('posts')
    .select('title, excerpt')
    .eq('slug', params.slug)
    .eq('published', true)
    .single()

  if (!post) return { title: 'Post Not Found – EdTheStatMan' }
  return {
    title: `${post.title} – EdTheStatMan`,
    description: post.excerpt ?? undefined,
  }
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient()
  const { data: post } = await admin
    .from('posts')
    .select('id, title, slug, content, excerpt, tag, access_level, published_at')
    .eq('slug', params.slug)
    .eq('published', true)
    .single()

  if (!post) notFound()

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  let userTier: string | null = null
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, subscription_status')
      .eq('id', session.user.id)
      .single()
    userTier = profile?.subscription_tier ?? 'free'
    if (userTier !== 'free' && profile?.subscription_status !== 'active') {
      userTier = 'free'
    }
  }

  const isPaid = userTier === 'basic' || userTier === 'premium'
  const canRead = isPaid || (userTier !== null && post.access_level === 'free')

  const teaser = stripHtml(post.content).slice(0, 320) + '…'

  return (
    <main>
      <article className="blog-post">
        <div className="container">
          <header className="blog-post__header">
            <Link href="/blog" className="blog-post__back">← Back to Blog</Link>
            <div className="blog-post__meta-row">
              <span className="blog-card__tag">{post.tag}</span>
              {post.access_level === 'members' && (
                <span className="blog-post__members-badge">Members Only</span>
              )}
              {post.published_at && (
                <span className="blog-post__date">{fmtDate(post.published_at)}</span>
              )}
            </div>
            <h1 className="blog-post__title">{post.title}</h1>
            {post.excerpt && <p className="blog-post__excerpt-lead">{post.excerpt}</p>}
          </header>

          {canRead ? (
            <div
              className="blog-post__content"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          ) : (
            <>
              <div className="blog-post__teaser-wrap">
                <p className="blog-post__teaser-text">{teaser}</p>
                <div className="blog-post__teaser-fade" />
              </div>

              <div className="blog-post__gate">
                <div className="blog-post__gate-icon">🔒</div>
                {!session ? (
                  <>
                    <h2 className="blog-post__gate-title">
                      {post.access_level === 'free'
                        ? 'Sign in to read this post'
                        : 'Members only content'}
                    </h2>
                    <p className="blog-post__gate-desc">
                      {post.access_level === 'free'
                        ? 'Create a free account to read this article.'
                        : 'This post is for Basic and Premium members. Sign in or subscribe to continue reading.'}
                    </p>
                    <div className="blog-post__gate-actions">
                      <Link href="/login" className="btn btn--primary">Sign In</Link>
                      <Link href="/signup" className="btn btn--outline">Create Account</Link>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 className="blog-post__gate-title">Members Only Content</h2>
                    <p className="blog-post__gate-desc">
                      Upgrade to Basic or Premium to unlock all blog posts, betting systems, and trends.
                    </p>
                    <div className="blog-post__gate-actions">
                      <Link href="/betting-systems" className="btn btn--primary">View Plans →</Link>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </article>
    </main>
  )
}
