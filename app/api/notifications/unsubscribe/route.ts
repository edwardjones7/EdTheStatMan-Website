import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// One-click email unsubscribe. Reached from a link in the footer of a pick
// alert, or by a mail client honouring the List-Unsubscribe header — so it has
// to work with no session at all. The opaque notify_token is the only
// credential, which is why it's a uuid and not the profile id.

async function optOut(token: string | null): Promise<boolean> {
  if (!token) return false
  const admin = createAdminClient()
  const { data, error } = await (admin as any)
    .from('profiles')
    .update({ notify_email: false })
    .eq('notify_token', token)
    .select('id')

  return !error && Array.isArray(data) && data.length > 0
}

function page(message: string, detail: string): Response {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <title>${message}</title>
     <div style="font-family:sans-serif;max-width:520px;margin:80px auto;padding:0 24px;text-align:center">
       <h1 style="color:#2dd4bf">${message}</h1>
       <p style="color:#555;line-height:1.5">${detail}</p>
       <p><a href="/account" style="color:#2dd4bf">Manage your notification settings</a></p>
     </div>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  return (await optOut(token))
    ? page('Unsubscribed', "You won't get pick alert emails any more. You can turn them back on from your account at any time.")
    : page('Link not recognised', 'That unsubscribe link is invalid or has already been used. You can change the setting from your account page.')
}

// RFC 8058 one-click: mail clients POST to the List-Unsubscribe URL and expect
// a bare 200, not HTML.
export async function POST(req: Request) {
  const token = new URL(req.url).searchParams.get('token')
  const ok = await optOut(token)
  return NextResponse.json({ success: ok }, { status: ok ? 200 : 400 })
}
