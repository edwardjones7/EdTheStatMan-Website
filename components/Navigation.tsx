import { createClient } from '@/lib/supabase/server'
import NavClient from './NavClient'

export default async function Navigation() {
  const supabase = await createClient()

  // getSession reads from cookie — no network call, reliable in server components
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('full_name, subscription_tier, is_admin')
      .eq('id', user.id)
      .single()

    profile = {
      email: user.email!,
      full_name: data?.full_name ?? null,
      subscription_tier: data?.subscription_tier ?? 'free',
      is_admin: data?.is_admin ?? false,
    }
  }

  return <NavClient user={profile} />
}
