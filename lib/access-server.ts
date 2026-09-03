// Server-side access resolution.
//
// Separate from lib/access.ts so that module stays import-free and usable from
// client components. This is the half that touches Supabase.
//
// Every gated page previously repeated the same nine lines: getUser() ->
// select(ACCESS_SELECT) -> resolveAccess(). That block lived in ten files and
// app/account/page.tsx had drifted into its own variant. Use these instead.

import { createClient } from '@/lib/supabase/server'
import {
  resolveAccess,
  ACCESS_SELECT,
  BILLING_SELECT,
  type Access,
} from '@/lib/access'

/**
 * The current visitor's entitlement.
 *
 * Pass `{ billing: true }` only where BILLING STATE is rendered (the account
 * page, dunning banners). Entitlement itself never depends on those columns —
 * access_expires_at remains the only input — and the extra columns are wasted
 * bytes on every other page.
 */
export async function getAccess(opts?: { billing?: boolean }): Promise<Access> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return resolveAccess(null, false)

  const cols = opts?.billing ? `${ACCESS_SELECT}, ${BILLING_SELECT}` : ACCESS_SELECT
  const { data } = await (supabase as any)
    .from('profiles')
    .select(cols)
    .eq('id', user.id)
    .single()

  return resolveAccess(data as any, true)
}

/**
 * Access plus the profile fields the nav and account header render.
 * components/Navigation.tsx needs full_name alongside the entitlement, and
 * doing it in one round trip matters: this runs on every page.
 */
export async function getAccessWithProfile(): Promise<{
  access: Access
  userId: string | null
  email: string | null
  fullName: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { access: resolveAccess(null, false), userId: null, email: null, fullName: null }
  }

  const { data } = await (supabase as any)
    .from('profiles')
    .select(`full_name, ${ACCESS_SELECT}`)
    .eq('id', user.id)
    .single()

  return {
    access: resolveAccess(data as any, true),
    userId: user.id,
    email: user.email ?? null,
    fullName: (data as any)?.full_name ?? null,
  }
}
