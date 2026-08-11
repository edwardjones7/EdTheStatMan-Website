import { createHash } from 'crypto'

// Server-only helpers for the /api/track ingest route.

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? ''
}

// Cookieless visitor identity: sha256(salt + NY-date + ip + ua), truncated.
// The daily-rotating salt component means the id can never be joined across
// days, so no durable identifier of any person is ever stored (Plausible-style).
// Salted with the New York date so rotation lines up with dashboard day buckets.
export function hashVisitor(ip: string, ua: string): string {
  const salt = process.env.ANALYTICS_SALT ?? ''
  const nyDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  return createHash('sha256').update(`${salt}${nyDate}${ip}${ua}`).digest('hex').slice(0, 32)
}

export function toNYDate(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

// Exact UTC instant of midnight in New York for a YYYY-MM-DD date. Tries both
// EST/EDT offsets and keeps the one that actually renders as midnight in NY.
export function nyMidnightUTC(dateStr: string): Date {
  for (const off of ['-04:00', '-05:00']) {
    const d = new Date(`${dateStr}T00:00:00${off}`)
    if (
      toNYDate(d) === dateStr &&
      d.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false }) === '00:00:00'
    ) return d
  }
  return new Date(`${dateStr}T00:00:00-05:00`)
}

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|pingdom|uptime|monitor|scrape|curl|wget|python-requests|python\/|java\/|go-http|axios|node-fetch|okhttp|libwww|facebookexternalhit|whatsapp|telegram|discordbot|slackbot|twitterbot|linkedinbot|embedly|quora link preview|vkshare|preview|prerender|phantomjs|selenium|playwright|puppeteer/i

export function isBotUA(ua: string): boolean {
  if (!ua) return true
  return BOT_RE.test(ua)
}
