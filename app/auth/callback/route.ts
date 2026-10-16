import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { safeNext } from '@/lib/safe-redirect'
import { notifySignup } from '@/lib/notify/admin'
import type { EmailOtpType } from '@supabase/supabase-js'
import { classifyAuthError, type AuthErrorCode } from '@/lib/auth-errors'
import { isFirstSignIn, recordSignupComplete } from '@/lib/signup-complete'


/**
 * Alert the admin channel, but only for the exchange that actually created an
 * account.
 *
 * This route is the landing point for FOUR flows -- email verification, the
 * magic link, OAuth, and a password reset -- and `next` does not separate them: a reset carries
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

/**
 * Where a failed link sends someone, keeping where they were headed so the
 * retry lands in the same place. A failed password-reset link goes back to the
 * reset form rather than to sign-in, which is the page that can send another.
 */
function failureUrl(origin: string, next: string, code: AuthErrorCode): string {
  if (next === '/reset-password') return `${origin}/forgot-password?error=${code}`
  return `${origin}/login?error=${code}&next=${encodeURIComponent(next)}`
}

/** Supabase's own ?error_code= on a link it refused (expired, already used). */
function linkErrorCode(searchParams: URLSearchParams): AuthErrorCode | null {
  const code = searchParams.get('error_code')
  const description = searchParams.get('error_description')
  if (!code && !searchParams.get('error')) return null
  return classifyAuthError({ code, message: description })
}

/**
 * What an unrecognised failure most likely was. Our emailed links carry `via`
 * (and a reset carries next=/reset-password), so a failure on one is almost
 * always an expired or already-used link, and "request another" is the fix that
 * works. With neither, the visitor came back from Google -- a cancelled consent
 * screen lands here as ?error=access_denied.
 */
function fallbackFor(via: string | null, next: string): AuthErrorCode {
  if (via || next === '/reset-password') return 'expired'
  return 'google'
}

const OTP_TYPES: EmailOtpType[] = ['signup', 'magiclink', 'recovery', 'invite', 'email_change', 'email']

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // The token_hash form of an emailed link. Not what the default Supabase
  // templates send (they send {{ .ConfirmationURL }}, which arrives here as
  // `code`), but supported so the templates can be switched to
  // `/auth/callback?token_hash={{ .TokenHash }}&type=...` -- that form works when
  // the link is opened in a different browser, which the PKCE `code` does not.
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type') as EmailOtpType | null
  // Validate: an attacker-controlled `next` here is a phishing primitive.
  const next = safeNext(searchParams.get('next'), '/')
  const via = searchParams.get('via')

  let refused = linkErrorCode(searchParams)
  if (refused === 'auth') refused = fallbackFor(via, next)
  if (refused && !code && !tokenHash) {
    return NextResponse.redirect(failureUrl(origin, next, refused))
  }

  if (code || (tokenHash && otpType && OTP_TYPES.includes(otpType))) {
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

    // One path for both link shapes: OAuth and the default email templates
    // send a PKCE `code`; a token_hash template is verified directly.
    const { data, error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: otpType! })

    if (!error) {
      const user = data?.user ?? null
      await announceIfNewSignup(user)
      if (user && isFirstSignIn(user)) {
        await recordSignupComplete(user, request.headers, {
          via: via === 'magic' || via === 'password' ? via : (user.app_metadata?.provider ?? null),
          next,
        })
      }
      return redirectResponse
    }

    const failed = classifyAuthError(error)
    const shown: AuthErrorCode = failed !== 'auth' ? failed : fallbackFor(via, next)
    return NextResponse.redirect(failureUrl(origin, next, shown))
  }

  return NextResponse.redirect(failureUrl(origin, next, refused ?? 'auth'))
}
