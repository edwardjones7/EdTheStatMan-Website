import { NextResponse } from 'next/server'
import { sendMagicLink } from '@/app/actions/auth'

/**
 * The free-picks email signup, shared by the homepage band and the footer.
 *
 * A route rather than a direct Server Action call because the footer is on
 * every page. A Server Action POSTs to the URL of the page it was called from,
 * and BotID only covers paths named in lib/botid-routes.ts, so calling
 * sendMagicLink from the footer would read every visitor on an unlisted page as
 * a bot. One fixed path needs one listing.
 *
 * sendMagicLink does the BotID check, the validation and the send. `next` is
 * fixed here, so a caller cannot choose where the link lands.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const formData = new FormData()
  formData.set('email', String(body?.email ?? ''))
  formData.set('next', '/portfolio')
  return NextResponse.json(await sendMagicLink(formData))
}
