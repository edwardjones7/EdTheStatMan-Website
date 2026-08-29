import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'
import {
  AUTH_TIMEOUT_MS,
  boundedAuthFetch,
  withAuthTimeout,
  type BoundedAuthFetch,
} from '@/lib/supabase/auth-timeout'

// Supabase Auth can degrade independently of Postgres (it did on 2026-08-29:
// /auth/v1/user hung for 12-30s while REST stayed at ~0.5s). Every dynamic
// render calls getUser() at least twice -- once in app/layout.tsx and again in
// the page -- so an unbounded call there hangs the whole render, not just auth.
//
// The bound lives in the factory rather than at the ~37 call sites so no call
// site can forget it, including ones added later. Timing out yields a null user
// (the same shape as signed-out), which every consumer already handles; pages
// re-check authorization server-side, so this never grants access it shouldn't.
function boundGetUser(
  client: SupabaseClient<Database>,
  auth: BoundedAuthFetch
): SupabaseClient<Database> {
  const original = client.auth.getUser.bind(client.auth)

  client.auth.getUser = (async (jwt?: string) => {
    try {
      const result = await withAuthTimeout(original(jwt), auth)
      if (!result) {
        return {
          data: { user: null },
          error: new Error(`Supabase auth.getUser exceeded ${AUTH_TIMEOUT_MS}ms`),
        }
      }
      return result
    } catch (error) {
      // Auth unreachable — degrade to signed-out rather than failing the render.
      return { data: { user: null }, error }
    }
  }) as typeof client.auth.getUser

  return client
}

export async function createClient() {
  const cookieStore = await cookies()
  const auth = boundedAuthFetch()

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // A render cannot persist a rotated refresh token (see setAll below), so
      // any refresh it starts is one middleware has to redo. Aborting on
      // timeout keeps a slow one from redeeming the token behind our back and
      // stranding the rotated value somewhere it can never be written.
      global: { fetch: auth.fetch },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — middleware handles session refresh
          }
        },
      },
    }
  )

  return boundGetUser(client, auth)
}
