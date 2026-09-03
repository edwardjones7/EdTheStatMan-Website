// EdTheStatBot's daily message allowance.
//
// The only cost ceiling on /api/statbot. Every message calls a frontier model,
// and the retail rung is free, so without this a signed-in non-payer can run up
// an unbounded bill in a loop.
//
// Backed by public.ai_usage and consume_ai_quota() -- see
// supabase/migrations/ai_usage_01_quota.sql for why the counter lives in
// Postgres and why the claim is a single statement.

import { createHash } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Tier } from '@/lib/access'

/**
 * Messages per person per day, by rung.
 *
 * Retail is deliberately low: it is a free tier, and hitting the cap is itself
 * the upgrade prompt. The paid rungs are set well above any plausible session
 * so a real member never meets them -- this is an abuse and runaway-loop
 * ceiling, not a usage meter anyone is meant to ration against.
 */
export const DAILY_LIMIT: Record<Tier, number> = {
  retail: 10,
  portfolio: 40,
  desk: 100,
  private: 250,
  institutional: 500,
}

export interface QuotaResult {
  allowed: boolean
  used: number
  remaining: number
  limit: number
  /** Midnight New York, when the allowance rolls over. */
  resetsAt: string
}

/** Next New York midnight, as an ISO instant. */
function nextNyMidnight(now = new Date()): string {
  // Render "now" in New York, step to the next day, and read back the UTC
  // instant of that local midnight. Tries both offsets so it stays correct
  // across a DST boundary -- the same trick nyMidnightUTC() uses in
  // lib/analytics.ts.
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  ny.setHours(0, 0, 0, 0)
  ny.setDate(ny.getDate() + 1)
  const y = ny.getFullYear()
  const m = String(ny.getMonth() + 1).padStart(2, '0')
  const d = String(ny.getDate()).padStart(2, '0')
  for (const offset of ['-04:00', '-05:00']) {
    const candidate = new Date(`${y}-${m}-${d}T00:00:00${offset}`)
    const back = new Date(candidate.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    if (back.getHours() === 0 && back.getDate() === ny.getDate()) return candidate.toISOString()
  }
  return new Date(`${y}-${m}-${d}T00:00:00-05:00`).toISOString()
}

/**
 * Claim one message against today's allowance.
 *
 * Admins bypass entirely -- they are the ones testing it, and a locked-out
 * admin cannot diagnose the thing that locked them out.
 *
 * FAILS OPEN. If the RPC errors -- most likely because
 * ai_usage_01_quota.sql has not been applied by hand yet -- this logs loudly
 * and allows the message. Refusing every paying member because a migration is
 * outstanding is a worse failure than a short window of uncapped usage. The log
 * line is the signal that the migration is missing.
 */
export async function consumeQuota(
  userId: string,
  tier: Tier,
  isAdmin: boolean
): Promise<QuotaResult> {
  const limit = DAILY_LIMIT[tier] ?? DAILY_LIMIT.retail
  const resetsAt = nextNyMidnight()

  if (isAdmin) {
    return { allowed: true, used: 0, remaining: limit, limit, resetsAt }
  }

  const admin = createAdminClient() as any
  const { data, error } = await admin.rpc('consume_ai_quota', {
    p_user: userId,
    p_limit: limit,
  })

  if (error) {
    console.error(`[statbot] quota check failed, allowing through: ${error.message}`)
    return { allowed: true, used: 0, remaining: limit, limit, resetsAt }
  }

  // The function returns a one-row table.
  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    console.error('[statbot] quota check returned no row, allowing through')
    return { allowed: true, used: 0, remaining: limit, limit, resetsAt }
  }

  return {
    allowed: !!row.allowed,
    used: Number(row.used ?? 0),
    remaining: Number(row.remaining ?? 0),
    limit,
    resetsAt,
  }
}

/**
 * Record what a finished response cost. Best effort: a failure here must never
 * affect the user, who has already had their answer.
 */
export async function recordTokens(userId: string, tokensIn: number, tokensOut: number) {
  if (!tokensIn && !tokensOut) return
  try {
    const admin = createAdminClient() as any
    await admin.rpc('record_ai_tokens', {
      p_user: userId,
      p_in: Math.max(0, Math.round(tokensIn)),
      p_out: Math.max(0, Math.round(tokensOut)),
    })
  } catch (e: any) {
    console.error(`[statbot] token accounting failed: ${e?.message}`)
  }
}

// ---------------------------------------------------------------------------
// Anonymous callers
// ---------------------------------------------------------------------------
// EdTheStatBot is mounted for signed-out visitors too -- he is the conversion
// surface, and a bot that will not talk to anyone who has not signed up is not
// on "every part of the site". Those callers have no profiles row, so they are
// counted separately, keyed by a salted hash of the caller IP.

/**
 * Messages per anonymous caller per day.
 *
 * Deliberately tiny. An anonymous caller is a stranger with a two-tool toolset
 * answering "what is this and what does it cost"; five messages is more than
 * that conversation needs and small enough that a scraper gets nothing worth
 * the trouble. The sixth message is the sign-up prompt.
 */
export const ANON_DAILY_LIMIT = 5

/**
 * A stable per-day identifier for a caller we cannot name.
 *
 * SALTED, and the raw address is never stored. The salt is the service role key
 * because it is already required by this module, is never shipped to a browser,
 * and rotating it simply resets everyone's anonymous counter -- which is the
 * correct behaviour for a 24-hour abuse ceiling.
 *
 * Returns null when there is no usable address. Callers must treat that as
 * "refuse", not "allow": an unidentifiable caller is exactly the shape of the
 * traffic this limit exists to stop.
 */
export function hashCaller(req: Request): string | null {
  // x-forwarded-for is a client-controlled header everywhere EXCEPT behind a
  // proxy that overwrites it. On Vercel it is overwritten, so the LEFTMOST
  // entry is the real client. Do not read this on any other host without
  // checking that assumption first.
  const fwd = req.headers.get('x-forwarded-for')
  const ip = fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim()
  if (!ip) return null

  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  return createHash('sha256').update(`statbot:${salt}:${ip}`).digest('hex').slice(0, 48)
}

/**
 * Claim one message against an anonymous caller's allowance.
 *
 * FAILS CLOSED, unlike consumeQuota(). The reasoning is not symmetrical:
 * refusing a signed-in paying member because a migration is outstanding is
 * worse than a short window of uncapped usage, but an uncapped ANONYMOUS model
 * endpoint on a public page is an open invitation with our name on the bill.
 * When the RPC is unavailable the bot simply asks strangers to sign in.
 */
export async function consumeAnonQuota(ipHash: string | null): Promise<QuotaResult> {
  const limit = ANON_DAILY_LIMIT
  const resetsAt = nextNyMidnight()

  if (!ipHash) {
    return { allowed: false, used: limit, remaining: 0, limit, resetsAt }
  }

  const admin = createAdminClient() as any
  const { data, error } = await admin.rpc('consume_ai_quota_anon', {
    p_ip: ipHash,
    p_limit: limit,
  })

  if (error) {
    console.error(`[statbot] anon quota unavailable, refusing: ${error.message}`)
    return { allowed: false, used: limit, remaining: 0, limit, resetsAt }
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    console.error('[statbot] anon quota returned no row, refusing')
    return { allowed: false, used: limit, remaining: 0, limit, resetsAt }
  }

  return {
    allowed: !!row.allowed,
    used: Number(row.used ?? 0),
    remaining: Number(row.remaining ?? 0),
    limit,
    resetsAt,
  }
}

/** Anonymous twin of recordTokens(). Best effort, same as its sibling. */
export async function recordAnonTokens(ipHash: string | null, tokensIn: number, tokensOut: number) {
  if (!ipHash || (!tokensIn && !tokensOut)) return
  try {
    const admin = createAdminClient() as any
    await admin.rpc('record_ai_tokens_anon', {
      p_ip: ipHash,
      p_in: Math.max(0, Math.round(tokensIn)),
      p_out: Math.max(0, Math.round(tokensOut)),
    })
  } catch (e: any) {
    console.error(`[statbot] anon token accounting failed: ${e?.message}`)
  }
}
