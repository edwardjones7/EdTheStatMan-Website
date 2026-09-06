import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { safeNext } from '@/lib/safe-redirect'
import { notifySignup } from '@/lib/notify/admin'


/**
 * Alert the admin channel, but only for the exchange that actually created an
 * account.
 *
 * This route is the landing point for THREE flows -- email verification, OAuth,
 * and a password reset -- and `next` does not separate them: a reset carries
 * /reset-password, but a signup's `next` is wherever the visitor started and
 * OAuth carries none at all.
 *
 * `email_confirmed_at` does separate them. It is null until the address is
 * confirmed and is stamped by this very exchange, so a value seconds old means
 * "this request is the one that confirmed the account". A password reset lands
 * here with a confirmation timestamp from whenever they originally signed up,
 * days or months back, and is ignored. A first OAuth sign-in is stamped now and
 * is announced, which is right -- that is a new account too.
 *
 * Firing once is the auth code's doing, not ours: exchangeCodeForSession
 * consumes a single-use code, so a second click on the same email link fails
 * the exchange and never reaches here.
 *
 * Never allowed to fail the request. Someone is mid-redirect waiting to be
 * logged in; an unsent Discord message must not cost them their session.
 */
const CONFIRMED_WINDOW_MS = 2 * 60 * 1000

async function announceIfNewSignup(user: { email?: string | null; email_confirmed_at?: string | null; user_metadata?: Record<string, any> | null; app_metadata?: Record<string, any> | null } | null) {
  try {
    if (!user?.email_confirmed_at) return
    const confirmedAgo = Date.now() - new Date(user.email_confirmed_at).getTime()
    if (!Number.isFinite(confirmedAgo) || confirmedAgo > CONFIRMED_WINDOW_MS) return

    await notifySignup({
      email: user.email ?? null,
      fullName: user.user_metadata?.full_name ?? null,
      provider: user.app_metadata?.provider ?? null,
    })
  } catch {
    // Deliberately swallowed. See the note above.
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // Validate: an attacker-controlled `next` here is a phishing primitive.
  const next = safeNext(searchParams.get('next'), '/')

  if (code) {
    const cookieStore = await cookies()
    const redirectResponse = NextResponse.redirect(`${origin}${next}`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              redirectResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      await announceIfNewSignup(data?.user ?? null)
      return redirectResponse
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
