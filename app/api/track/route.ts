import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function getDeviceType(ua: string): 'mobile' | 'tablet' | 'desktop' {
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

export async function POST(req: NextRequest) {
  try {
    const { path, referrer } = await req.json()
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    if (path.startsWith('/admin')) {
      return NextResponse.json({ ok: true })
    }

    const ua      = req.headers.get('user-agent') ?? ''
    const country = req.headers.get('x-vercel-ip-country') ?? null
    const device  = getDeviceType(ua)
    const admin   = createAdminClient() as any

    // Resolve logged-in user (best-effort)
    let userId: string | null = null
    try {
      const authClient = await createClient()
      const { data: { user } } = await authClient.auth.getUser()
      if (user) userId = user.id
    } catch {}

    // Insert page view
    await admin.from('page_views').insert({
      path,
      referrer:    referrer || null,
      user_agent:  ua || null,
      device_type: device,
      country,
      user_id:     userId,
    })

    // Update last_seen_at for logged-in users — throttled to once per 5 minutes
    if (userId) {
      const { data: profile } = await admin
        .from('profiles')
        .select('last_seen_at')
        .eq('id', userId)
        .single()

      const lastSeen   = profile?.last_seen_at ? new Date(profile.last_seen_at) : null
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

      if (!lastSeen || lastSeen < fiveMinAgo) {
        await admin
          .from('profiles')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', userId)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
