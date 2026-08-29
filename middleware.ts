import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/safe-redirect'
import {
  AUTH_COOKIE_PATTERN,
  boundedAuthFetch,
  isStaleRefreshToken,
  withAuthTimeout,
} from '@/lib/supabase/auth-timeout'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const auth = boundedAuthFetch()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: auth.fetch },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Middleware is the only place a rotated refresh token can actually be
  // persisted -- the Server Component client's setAll is a no-op (see
  // lib/supabase/server.ts). It writes the fresh token back onto
  // request.cookies as well, so the render downstream reads an unexpired token
  // and never races middleware for a second refresh.
  let user = null
  let authError: unknown = null

  try {
    const result = await withAuthTimeout(supabase.auth.getUser(), auth)
    user = result?.data.user ?? null
    authError = result?.error ?? null
  } catch (error) {
    // Auth unreachable -- serve the request rather than hanging on it.
    authError = error
  }

  // A retired refresh token will never succeed again and nothing else clears
  // it, so the browser replays it on every request and every request 400s.
  // Drop the cookie here and the session degrades to signed-out instead.
  if (isStaleRefreshToken(authError)) {
    for (const { name } of request.cookies.getAll()) {
      if (AUTH_COOKIE_PATTERN.test(name)) {
        supabaseResponse.cookies.set(name, '', { maxAge: 0, path: '/' })
      }
    }
    user = null
  }

  const { pathname } = request.nextUrl

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return redirectPreservingCookies(supabaseResponse, new URL('/login', request.url))
    }
  }

  // Protect account routes
  if (pathname.startsWith('/account')) {
    if (!user) {
      return redirectPreservingCookies(supabaseResponse, new URL('/login', request.url))
    }
  }

  // Redirect logged-in users away from auth pages, honouring any pending
  // destination so an in-flight purchase isn't dropped on the homepage.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const dest = safeNext(request.nextUrl.searchParams.get('next'), '/')
    return redirectPreservingCookies(supabaseResponse, new URL(dest, request.url))
  }

  return supabaseResponse
}

// A bare NextResponse.redirect drops everything supabaseResponse was carrying,
// which is exactly the cookies that matter: a refreshed session, or the
// cleared one we just decided to expire. Losing the latter on the redirect to
// /login would leave the dead token in place and restart the 400 loop.
function redirectPreservingCookies(response: NextResponse, url: URL) {
  const redirect = NextResponse.redirect(url)
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
  return redirect
}

export const config = {
  matcher: [
    // The Stripe webhook authenticates by signature and uses the admin client;
    // it has no session to refresh and must not depend on Supabase Auth.
    '/((?!api/stripe/webhook|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
