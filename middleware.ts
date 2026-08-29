import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { safeNext } from '@/lib/safe-redirect'

// Supabase Auth outages must not take the whole site down. Vercel kills a
// middleware invocation at 25s, so an unbounded getUser() against a hung
// /auth/v1/user turns every request carrying a session cookie into a 504.
// Bound it well under that and fall back to "signed out" instead.
const AUTH_TIMEOUT_MS = 2500

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  let timer: ReturnType<typeof setTimeout> | undefined
  let user = null

  try {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), AUTH_TIMEOUT_MS)
      }),
    ])
    user = result?.data.user ?? null
  } catch {
    // Auth unreachable — serve the request rather than hanging on it.
    user = null
  } finally {
    clearTimeout(timer)
  }

  const { pathname } = request.nextUrl

  // Protect admin routes
  if (pathname.startsWith('/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Protect account routes
  if (pathname.startsWith('/account')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Redirect logged-in users away from auth pages, honouring any pending
  // destination so an in-flight purchase isn't dropped on the homepage.
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const dest = safeNext(request.nextUrl.searchParams.get('next'), '/')
    return NextResponse.redirect(new URL(dest, request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // The Stripe webhook authenticates by signature and uses the admin client;
    // it has no session to refresh and must not depend on Supabase Auth.
    '/((?!api/stripe/webhook|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
