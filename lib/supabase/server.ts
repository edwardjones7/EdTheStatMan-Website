import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/types'

// Supabase Auth can degrade independently of Postgres (it did on 2026-08-29:
// /auth/v1/user hung for 12-30s while REST stayed at ~0.5s). Every dynamic
// render calls getUser() at least twice -- once in app/layout.tsx and again in
// the page -- so an unbounded call there hangs the whole render, not just auth.
//
// The bound lives in the factory rather than at the ~37 call sites so no call
// site can forget it, including ones added later. Timing out yields a null user
// (the same shape as signed-out), which every consumer already handles; pages
// re-check authorization server-side, so this never grants access it shouldn't.
const AUTH_TIMEOUT_MS = 2500

function boundGetUser(client: SupabaseClient<Database>): SupabaseClient<Database> {
  const original = client.auth.getUser.bind(client.auth)
  const timedOut = Symbol('supabase-auth-timeout')

  client.auth.getUser = (async (jwt?: string) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        original(jwt),
        new Promise<typeof timedOut>((resolve) => {
          timer = setTimeout(() => resolve(timedOut), AUTH_TIMEOUT_MS)
        }),
      ])

      if (result === timedOut) {
        return {
          data: { user: null },
          error: new Error(`Supabase auth.getUser exceeded ${AUTH_TIMEOUT_MS}ms`),
        }
      }
      return result
    } catch (error) {
      // Auth unreachable — degrade to signed-out rather than failing the render.
      return { data: { user: null }, error }
    } finally {
      clearTimeout(timer)
    }
  }) as typeof client.auth.getUser

  return client
}

export async function createClient() {
  const cookieStore = await cookies()

  const client = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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

  return boundGetUser(client)
}
