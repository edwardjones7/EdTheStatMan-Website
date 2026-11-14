'use client'

import { useEffect } from 'react'
import { ADMIN_FLAG_KEY } from '@/lib/track-client'

/**
 * Marks this browser as an admin's, so it stops counting toward traffic even
 * after signing out (lib/track-client.ts canTrack). Rendered by the root layout
 * for admins only; renders nothing.
 */
export default function AdminBrowserFlag() {
  useEffect(() => {
    try { localStorage.setItem(ADMIN_FLAG_KEY, '1') } catch {}
  }, [])
  return null
}
