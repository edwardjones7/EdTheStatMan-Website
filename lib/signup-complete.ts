// Records the `signup_complete` funnel event, server side, once per account.
//
// SERVER ONLY: uses the service-role client, the same way app/api/track does,
// because `events` has RLS on and no policies.

import { createAdminClient } from '@/lib/supabase/admin'
import { getClientIp, hashVisitor } from '@/lib/analytics'

/**
 * How recent a confirmation has to be for this request to be the one that
 * created the account.
 *
 * WHY THE CONFIRMATION STAMP AND NOT profiles.created_at. A magic-link account
 * is created when the link is REQUESTED, and the link is good for an hour, so
 * someone who opens it twenty minutes later has a profile twenty minutes old.
 * `email_confirmed_at` is stamped by the click itself, seconds before the
 * redirect lands on /auth/callback, for every route in: magic link, the
 * password confirmation mail, and a first Google sign-in. A returning user's
 * stamp is from whenever they first joined and never qualifies.
 *
 * Five minutes rather than seconds to absorb clock skew between Supabase and
 * Vercel. The dedupe below is what actually prevents double counting.
 */
const FIRST_SIGN_IN_WINDOW_MS = 5 * 60 * 1000

interface SignupUser {
  id: string
  email_confirmed_at?: string | null
  created_at?: string | null
  app_metadata?: Record<string, any> | null
}

export function isFirstSignIn(user: SignupUser | null | undefined): boolean {
  if (!user) return false
  const stamp = user.email_confirmed_at ?? null
  if (!stamp) return false
  const ago = Date.now() - new Date(stamp).getTime()
  return Number.isFinite(ago) && ago >= -FIRST_SIGN_IN_WINDOW_MS && ago <= FIRST_SIGN_IN_WINDOW_MS
}

/**
 * Insert one `signup_complete` row for this user, unless one already exists.
 *
 * The existence check is the double-count guard: the confirmation window can in
 * principle be hit twice (a second tab, a retried redirect), and an account is
 * only ever created once. Never throws. Someone is mid-redirect waiting to be
 * signed in, and a lost analytics row must not cost them their session.
 */
export async function recordSignupComplete(
  user: SignupUser,
  reqHeaders: Headers,
  meta: Record<string, unknown>
): Promise<void> {
  try {
    const admin = createAdminClient() as any
    const { data: existing } = await admin
      .from('events')
      .select('id')
      .eq('event_type', 'signup_complete')
      .eq('user_id', user.id)
      .limit(1)
    if (existing && existing.length > 0) return

    // Headers rather than a Request so a Server Action (which has no Request,
    // only headers()) can call this too. getClientIp only reads headers.
    const ua = reqHeaders.get('user-agent') ?? ''
    const ip = getClientIp({ headers: reqHeaders } as Request)
    await admin.from('events').insert({
      event_type: 'signup_complete',
      path: '/auth/callback',
      visitor_id: hashVisitor(ip, ua),
      user_id: user.id,
      meta: { provider: user.app_metadata?.provider ?? null, ...meta },
    })
  } catch {
    // Deliberately swallowed. See above.
  }
}
