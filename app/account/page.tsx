import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountClient from '@/components/AccountClient'

export const metadata: Metadata = {
  title: 'My Account – EdTheStatMan.com',
  description: 'Manage your EdTheStatMan account and membership.',
  robots: { index: false, follow: false },
}

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('full_name, subscription_tier, is_admin, created_at, stripe_customer_id, access_expires_at')
    .eq('id', user.id)
    .single()

  const provider = user.app_metadata?.provider ?? 'email'

  return (
    <AccountClient
      profile={{
        email: user.email!,
        full_name: profile?.full_name ?? null,
        subscription_tier: profile?.subscription_tier ?? 'free',
        access_expires_at: profile?.access_expires_at ?? null,
        is_admin: profile?.is_admin ?? false,
        created_at: profile?.created_at ?? user.created_at,
        stripe_customer_id: profile?.stripe_customer_id ?? null,
      }}
      provider={provider}
    />
  )
}
