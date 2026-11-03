import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The same check every app/api/admin route makes: a signed-in user whose
 * profile says is_admin. Kept in one place for the pick-drafts routes rather
 * than copied into each of them again.
 */
export async function assertAdmin(): Promise<{ ok: false } | { ok: true; admin: any }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false }
  const admin = createAdminClient() as any
  const { data: p } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return p?.is_admin ? { ok: true, admin } : { ok: false }
}
