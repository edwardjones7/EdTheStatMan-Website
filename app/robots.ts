import type { MetadataRoute } from 'next'

/**
 * AI training and bulk-scrape crawlers. They bring no visitors, and walking
 * every Desk game, team and Vault page they cost real database reads -- part
 * of what pushed the project over the Supabase Free plan in Nov 2026.
 * Search engines (Googlebot, Bingbot, ...) stay allowed under '*'.
 */
const BLOCKED_BOTS = [
  'GPTBot',
  'ChatGPT-User',
  'OAI-SearchBot',
  'CCBot',
  'ClaudeBot',
  'anthropic-ai',
  'Claude-Web',
  'Google-Extended',
  'Bytespider',
  'Amazonbot',
  'Applebot-Extended',
  'PerplexityBot',
  'meta-externalagent',
  'FacebookBot',
  'Diffbot',
  'Omgilibot',
  'ImagesiftBot',
  'cohere-ai',
  'AhrefsBot',
  'SemrushBot',
  'MJ12bot',
  'DotBot',
  'PetalBot',
  'DataForSeoBot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/account/', '/api/'],
      },
      { userAgent: BLOCKED_BOTS, disallow: '/' },
    ],
    sitemap: 'https://edthestatman.com/sitemap.xml',
  }
}
