import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getClientIp, hashVisitor, isBotUA } from '@/lib/analytics'

const ALLOWED_EVENTS = ['checkout_click']

function getDeviceType(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

function clean(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const path = typeof body.path === 'string' ? body.path : ''
    if (!path.startsWith('/') || path.length > 500) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    if (path.startsWith('/admin')) {
      return NextResponse.json({ ok: true })
    }

    const ua = req.headers.get('user-agent') ?? ''
    if (isBotUA(ua)) {
      return NextResponse.json({ ok: true })
    }

    const country   = req.headers.get('x-vercel-ip-country') ?? null
    const device    = getDeviceType(ua)
    const visitorId = hashVisitor(getClientIp(req), ua)
    const admin     = createAdminClient() as any

    // Resolve logged-in user (best-effort)
    let userId: string | null = null
    try {
      const authClient = await createClient()
      const { data: { user } } = await authClient.auth.getUser()
      if (user) userId = user.id
    } catch {}

    const eventType = typeof body.event === 'string' ? body.event : null
    if (eventType) {
      if (!ALLOWED_EVENTS.includes(eventType)) {
        return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
      }
      await admin.from('events').insert({
        event_type: eventType,
        path,
        visitor_id: visitorId,
        user_id:    userId,
        meta:       body.meta && typeof body.meta === 'object' ? body.meta : null,
      })
      return NextResponse.json({ ok: true })
    }

    const utm = body.utm && typeof body.utm === 'object' ? body.utm : {}
    await admin.from('page_views').insert({
      path,
      referrer:     clean(body.referrer, 500),
      user_agent:   ua || null,
      device_type:  device,
      country,
      user_id:      userId,
      visitor_id:   visitorId,
      utm_source:   clean(utm.source),
      utm_medium:   clean(utm.medium),
      utm_campaign: clean(utm.campaign),
    })

    let stamped = false
    if (userId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('last_seen_at, attributed_at')
        .eq('id', userId)
        .single()

      // Update last_seen_at — throttled to once per 5 minutes
      const lastSeen   = profile?.last_seen_at ? new Date(profile.last_seen_at) : null
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
      if (!lastSeen || lastSeen < fiveMinAgo) {
        await admin
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', userId)
      }

      // Stamp first-touch attribution onto the profile, once ever
      const firstTouch = body.firstTouch && typeof body.firstTouch === 'object' ? body.firstTouch : null
      if (firstTouch && !profile?.attributed_at) {
        await admin.from('profiles').update({
          utm_source:     clean(firstTouch.source),
          utm_medium:     clean(firstTouch.medium),
          utm_campaign:   clean(firstTouch.campaign),
          first_referrer: clean(firstTouch.referrer, 500),
          landing_page:   clean(firstTouch.landing_page, 500),
          attributed_at:  new Date().toISOString(),
        }).eq('id', userId)
        stamped = true
      } else if (firstTouch && profile?.attributed_at) {
        // Already attributed — tell the client to stop sending it
        stamped = true
      }
    }

    return NextResponse.json({ ok: true, ...(stamped ? { stamped: true } : {}) })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
