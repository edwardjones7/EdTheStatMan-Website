import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/site-url'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Start the Discord link.
 *
 * Only `identify` is requested -- the bot needs the member's Discord user id and
 * nothing else. It does not read their email, their servers, or their messages,
 * and asking for less makes the consent screen honest.
 *
 * The signed-in Supabase user is taken from the SESSION on the way back, never
 * from the OAuth state. State exists solely as a CSRF nonce: if identity rode in
 * the state parameter, anyone could hand a victim a link that attaches their own
 * Discord account to somebody else's membership.
 */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${siteUrl()}/login?next=%2Faccount`)

  const clientId = process.env.DISCORD_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(`${siteUrl()}/account?discord=not-configured`)
  }

  const state = crypto.randomBytes(16).toString('hex')
  cookies().set('discord_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', `${siteUrl()}/api/discord/callback`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'identify')
  url.searchParams.set('state', state)

  return NextResponse.redirect(url.toString())
}
