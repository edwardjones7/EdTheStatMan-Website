import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { path, referrer } = await req.json()
    if (!path || typeof path !== 'string') {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }
    // Skip admin pages
    if (path.startsWith('/admin')) {
      return NextResponse.json({ ok: true })
    }
    const supabase = createAdminClient() as any
    await supabase.from('page_views').insert({ path, referrer: referrer || null })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
