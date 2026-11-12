// Supabase Auth can degrade independently of Postgres (it did on 2026-08-29:
// /auth/v1/user hung for 12-30s while REST stayed at ~0.5s). Vercel kills a
// middleware invocation at 25s and every dynamic render calls getUser() at
// least twice -- once in app/layout.tsx and again in the page -- so an
// unbounded call hangs the whole request, not just auth.
export const AUTH_TIMEOUT_MS = 2500

// Ceiling on a single REST read made while rendering a page. On 2026-11-12 the
// whole project became unreachable (Free plan quota restriction, during a
// Supabase connection incident) and every read hung for 30-120s, so every page
// hung with it. A read that fails fast returns an error, which every page
// already treats as "no rows" and renders around. Writes are not bounded.
export const REST_READ_TIMEOUT_MS = 6000

/** Adds REST_READ_TIMEOUT_MS to a GET/HEAD; anything else passes through. */
export function boundRead(init: RequestInit | undefined, ms = REST_READ_TIMEOUT_MS): RequestInit | undefined {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') return init
  if (typeof AbortSignal.timeout !== 'function') return init
  const timeout = AbortSignal.timeout(ms)
  return { ...init, signal: mergeSignals(timeout, init?.signal) }
}

// The session cookie @supabase/ssr writes (`sb-<project-ref>-auth-token`),
// including the `.0`/`.1` chunks it splits an oversized session across.
export const AUTH_COOKIE_PATTERN = /^sb-.+-auth-token(\.\d+)?$/

export type BoundedAuthFetch = {
  fetch: typeof fetch
  abort: () => void
}

/**
 * A fetch that only ever issues one Auth request we are still willing to honour.
 *
 * Bounding getUser() with Promise.race alone stops us *waiting* on a slow Auth
 * but leaves the request itself in flight. When that request is a token
 * refresh it lands after the response has already been sent, calls setAll on a
 * dead response, and the rotated refresh token is persisted nowhere -- so the
 * client keeps replaying a token Supabase has already retired and every later
 * refresh 400s, forever. Aborting the underlying fetch instead means a
 * timed-out refresh never rotates the token at all, which leaves the cookie we
 * already hold usable on the next request.
 */
export function boundedAuthFetch(): BoundedAuthFetch {
  const controller = new AbortController()

  const boundFetch: typeof fetch = (input, init) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    // Auth gets the 2.5s abort below. REST reads get the looser
    // REST_READ_TIMEOUT_MS; REST writes (admin bulk imports) are never bounded.
    if (!url.includes('/auth/v1/')) return fetch(input, boundRead(init))

    return fetch(input, { ...init, signal: mergeSignals(controller.signal, init?.signal) })
  }

  return { fetch: boundFetch, abort: () => controller.abort() }
}

function mergeSignals(ours: AbortSignal, theirs: AbortSignal | null | undefined): AbortSignal {
  if (!theirs) return ours
  return typeof AbortSignal.any === 'function' ? AbortSignal.any([ours, theirs]) : ours
}

const TIMED_OUT = Symbol('supabase-auth-timeout')

/**
 * Resolves `null` if the Auth call outruns AUTH_TIMEOUT_MS, aborting the
 * in-flight request on the way out so it cannot write cookies late. `null` has
 * the same meaning every call site already handles: treat the user as signed
 * out and let the server-side authorization checks run as normal.
 */
export async function withAuthTimeout<T>(
  work: Promise<T>,
  auth: BoundedAuthFetch
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const result = await Promise.race([
      work,
      new Promise<typeof TIMED_OUT>((resolve) => {
        timer = setTimeout(() => resolve(TIMED_OUT), AUTH_TIMEOUT_MS)
      }),
    ])

    if (result === TIMED_OUT) {
      auth.abort()
      return null
    }
    return result as T
  } finally {
    clearTimeout(timer)
  }
}

/**
 * True only for a refresh token Supabase has explicitly retired -- one that
 * will never succeed again, however many times it is retried.
 *
 * A timed-out or unreachable Auth is transient and the cookie is probably
 * still good, so an AbortError or a network failure deliberately does not
 * match: we must not sign people out over a blip.
 */
export function isStaleRefreshToken(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const { code, status, message } = error as {
    code?: string
    status?: number
    message?: string
  }

  if (code?.includes('refresh_token')) return true
  return (status === 400 || status === 401) && /refresh token/i.test(message ?? '')
}
