import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { IconLock } from '@/components/Icons'
import { coverForPost } from '@/lib/blog-images'
import { OFFER_ENTRY_PRICE } from '@/lib/offer'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { resolveAccess, ACCESS_SELECT, atLeastTier, normalizeTier } from '@/lib/access'

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function fmtDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const TAG_MODIFIER: Record<string, string> = {
  'NFL': 'nfl',
  'NBA': 'nba',
  'College Football': 'cfb',
  'College Basketball': 'cbb',
}

function tagClass(tag: string) {
  const mod = TAG_MODIFIER[tag]
  return mod ? `blog-post__tag blog-post__tag--${mod}` : 'blog-post__tag'
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const admin = createAdminClient()
  const { data: post } = await (admin as any)
    .from('posts')
    .select('title, excerpt, published_at, cover_image, tag')
    .eq('slug', params.slug)
    .eq('published', true)
    .single()

  if (!post) return { title: 'Post Not Found' }

  const url = `https://edthestatman.com/blog/${params.slug}`
  const cover = coverForPost(post.cover_image, post.tag, post.title, params.slug)
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.excerpt ?? undefined,
      url,
      siteName: 'EdTheStatMan',
      images: [{ url: cover }],
      publishedTime: post.published_at ?? undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt ?? undefined,
      images: [cover],
    },
  }
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient()
  const { data: post } = await (admin as any)
    .from('posts')
    .select('id, title, slug, content, excerpt, tag, access_level, published_at, cover_image')
    .eq('slug', params.slug)
    .eq('published', true)
    .single()

  if (!post) notFound()

  const supabase = await createClient()
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
  const { tier: userTier, isAdmin, isPaid, membership, expiresAt } = access

  const canRead = isAdmin || atLeastTier(userTier, normalizeTier(post.access_level))

  const plainText = stripHtml(post.content)
  const teaser = plainText.slice(0, 320) + '…'
  const readMinutes = Math.max(1, Math.round(plainText.split(/\s+/).length / 225))

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.excerpt ?? undefined,
            datePublished: post.published_at ?? undefined,
            author: { '@type': 'Organization', name: 'EdTheStatMan', url: 'https://edthestatman.com' },
            publisher: { '@type': 'Organization', name: 'EdTheStatMan', url: 'https://edthestatman.com' },
            url: `https://edthestatman.com/blog/${post.slug}`,
          }),
        }}
      />
      <article className="blog-post">
        <div className="container">
          <header className="blog-post__header">
            <Link href="/blog" className="blog-post__back">← Back to Blog</Link>
            <div className="blog-post__meta-row">
              <span className={tagClass(post.tag)}>{post.tag}</span>
              {post.access_level === 'members' && (
                <span className="blog-post__members-badge">Members Only</span>
              )}
              {post.published_at && (
                <span className="blog-post__date">{fmtDate(post.published_at)}</span>
              )}
              <span className="blog-post__readtime">{readMinutes} min read</span>
            </div>
            <h1 className="blog-post__title">{post.title}</h1>
            <div className="blog-post__title-rule" />
            {post.excerpt && <p className="blog-post__excerpt-lead">{post.excerpt}</p>}
          </header>

          <div className="blog-post__cover">
            <Image
              src={coverForPost(post.cover_image, post.tag, post.title, post.slug)}
              alt={post.title}
              fill
              sizes="(max-width: 900px) 100vw, 860px"
              priority
              style={{ objectFit: 'cover' }}
            />
          </div>

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
                <div className="blog-post__gate-icon"><IconLock size={28} /></div>
                {!user ? (
                  <>
                    <span className="blog-post__gate-eyebrow">Members Only</span>
                    <h2 className="blog-post__gate-title">Members Only Content</h2>
                    <p className="blog-post__gate-desc">
                      Full access unlocks every post, the complete systems library, and all
                      betting trends — a one-time payment from {OFFER_ENTRY_PRICE}, no subscription.
                    </p>
                    <div className="blog-post__gate-actions">
                      <Link href="/win" className="btn btn--primary">
                        Unlock Full Access — {OFFER_ENTRY_PRICE} →
                      </Link>
                      <Link href={`/signup?next=${encodeURIComponent(`/blog/${post.slug}`)}`} className="btn btn--outline">
                        Create Free Account
                      </Link>
                      <Link href={`/login?next=${encodeURIComponent(`/blog/${post.slug}`)}`} className="btn btn--secondary">
                        Sign In
                      </Link>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="blog-post__gate-eyebrow">
                      {membership === 'expired' ? 'Access Expired' : 'Members Only'}
                    </span>
                    <h2 className="blog-post__gate-title">
                      {membership === 'expired' ? 'Your access has expired' : 'Members Only Content'}
                    </h2>
                    <p className="blog-post__gate-desc">
                      {membership === 'expired'
                        ? 'Renew to pick up where you left off — every post, system, and trend.'
                        : `Unlock every post, the full systems library, and all betting trends from ${OFFER_ENTRY_PRICE}.`}
                    </p>
                    <div className="blog-post__gate-actions">
                      <Link href="/win" className="btn btn--primary">
                        {membership === 'expired' ? 'Renew Access →' : 'View Plans →'}
                      </Link>
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
