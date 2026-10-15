import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AccountClient from '@/components/AccountClient'
import { isPaidTier } from '@/lib/access'

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
    .select('full_name, subscription_tier, is_admin, created_at, stripe_customer_id, stripe_subscription_id, access_expires_at, notify_email')
    .eq('id', user.id)
    .single()

  // Queried SEPARATELY and allowed to fail. discord_user_id arrives with
  // discord_01_link.sql; folding it into the select above would repeat the exact
  // mistake that comment warns about -- one missing column errors the whole
  // query and blanks this page for every member. On its own, a miss just means
  // "not linked".
  const { data: link } = await (supabase as any)
    .from('profiles')
    .select('discord_user_id')
    .eq('id', user.id)
    .maybeSingle()
  const discordLinked = !!link?.discord_user_id

  // Onboarding checklist state, read only for paying members (nobody else
  // sees the checklist) and in parallel, since this page's latency is round
  // trips. Both reads are best-effort and default to "not done" on any error,
  // which at worst shows a step that is already done.
  let pushSubscribed = false
  let productVisited = false
  if (isPaidTier(profile?.subscription_tier) && !profile?.is_admin) {
    const [push, views] = await Promise.all([
      // push_subscriptions has a select-own policy, so the member's own
      // client can answer "any device subscribed?" without the service role.
      (supabase as any)
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then((r: any) => r, () => null),
      // page_views has no select policy, so this needs the service role.
      // Indexed on user_id, and limit(1) stops at the first hit.
      (createAdminClient() as any)
        .from('page_views')
        .select('id')
        .eq('user_id', user.id)
        .or('path.like./portfolio%,path.like./desk%,path.like./vault%')
        .limit(1)
        .then((r: any) => r, () => null),
    ])
    pushSubscribed = (push?.count ?? 0) > 0
    productVisited = (views?.data?.length ?? 0) > 0
  }

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
        // Deliberately NOT sub_tier / billing_mode: those columns arrive with
        // tier_ladder_03 and selecting one that does not exist errors the whole
        // query, blanking this page for every member. stripe_subscription_id is
        // already in production and answers the only question the UI asks.
        stripe_subscription_id: profile?.stripe_subscription_id ?? null,
        notify_email: profile?.notify_email ?? true,
      }}
      provider={provider}
      discordLinked={discordLinked}
      pushSubscribed={pushSubscribed}
      productVisited={productVisited}
    />
  )
}
