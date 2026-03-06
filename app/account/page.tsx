import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AccountClient from '@/components/AccountClient'

export const metadata: Metadata = {
  title: 'My Account – EdTheStatMan.com',
  description: 'Manage your EdTheStatMan account and membership.',
}

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, subscription_tier, subscription_status, is_admin, created_at, stripe_customer_id')
    .eq('id', session.user.id)
    .single()

  const provider = session.user.app_metadata?.provider ?? 'email'

  return (
    <AccountClient
      profile={{
        email: session.user.email!,
        full_name: profile?.full_name ?? null,
        subscription_tier: profile?.subscription_tier ?? 'free',
        subscription_status: profile?.subscription_status ?? null,
        is_admin: profile?.is_admin ?? false,
        created_at: profile?.created_at ?? session.user.created_at,
        stripe_customer_id: profile?.stripe_customer_id ?? null,
      }}
      provider={provider}
    />
  )
}
