import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { siteUrl } from '@/lib/site-url'
import { syncDiscordRole } from '@/lib/discord/roles'

export const dynamic = 'force-dynamic'

const back = (status: string) =>
  NextResponse.redirect(`${siteUrl()}/account?discord=${status}`)

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  // Identity comes from the session, never from the callback parameters.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${siteUrl()}/login?next=%2Faccount`)

  const expected = cookies().get('discord_oauth_state')?.value
  cookies().delete('discord_oauth_state')
  // Reject a callback we did not start. Without this, a link crafted by someone
  // else could attach THEIR Discord account to whoever clicked it.
  if (!state || !expected || state !== expected) return back('bad-state')
  if (!code) return back('cancelled')

  const clientId = process.env.DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET
  if (!clientId || !clientSecret) return back('not-configured')

  try {
    const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${siteUrl()}/api/discord/callback`,
      }),
    })
    if (!tokenRes.ok) {
      console.error('[discord] token exchange failed:', tokenRes.status, (await tokenRes.text()).slice(0, 200))
      return back('failed')
    }
    const { access_token: accessToken } = await tokenRes.json()

    const meRes = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!meRes.ok) return back('failed')
    const me = await meRes.json()

    const admin = createAdminClient()
    const { error } = await (admin as any)
      .from('profiles')
      .update({ discord_user_id: me.id })
      .eq('id', user.id)

    if (error) {
      // The unique index means a Discord account already claimed by another
      // profile is refused rather than silently moved -- otherwise a lapse on
      // one account would strip a role the other still pays for.
      if ((error.code === '23505') || /duplicate|unique/i.test(error.message)) {
        return back('already-linked')
      }
      console.error('[discord] could not store link:', error.message)
      return back('failed')
    }

    // Grant immediately if they are already paid, so the link feels instant
    // rather than waiting for the nightly sweep.
    const result = await syncDiscordRole(user.id)
    if (result.outcome === 'left-server') return back('join-server')

    return back('connected')
  } catch (err) {
    console.error('[discord] callback error:', err instanceof Error ? err.message : String(err))
    return back('failed')
  }
}
