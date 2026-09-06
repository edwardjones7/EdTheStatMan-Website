import { NextResponse } from 'next/server'
import { syncAllDiscordRoles } from '@/lib/discord/roles'

export const dynamic = 'force-dynamic'
// A sweep over every linked member, one Discord call each with a pause between.
export const maxDuration = 300

/**
 * Nightly reconciliation of Discord roles against site entitlement.
 *
 * THIS IS THE HALF THAT ACTUALLY MATTERS. Granting is event-driven -- a purchase
 * fires a Stripe webhook and the role appears at once. But LAPSING FIRES NO
 * EVENT: a one-time season pass simply reaches access_expires_at and Stripe,
 * which never had a subscription for it, says nothing. Without this sweep a
 * lapsed member keeps the role, the pings and the channel access indefinitely,
 * and the only signal is somebody noticing.
 *
 * It is also the repair path for anything the webhook missed -- a Discord
 * outage, a rate limit, a role changed by hand in the server.
 */
export async function GET(req: Request) {
  // Vercel signs its cron invocations with CRON_SECRET when the variable is
  // set. Without the check this route is a public endpoint that hammers the
  // Discord API for anyone who finds it.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const started = Date.now()
  const tally = await syncAllDiscordRoles()
  const ms = Date.now() - started

  // Logged as well as returned: the cron's response is only visible in the
  // Vercel dashboard, and drift is worth finding in the function logs later.
  console.log('[discord] nightly sync', JSON.stringify(tally), `${ms}ms`)

  return NextResponse.json({ ok: true, ms, ...tally })
}
