'use client'

// First-touch marketing attribution, kept in localStorage. Only campaign
// labels are stored (utm params + referrer + landing page) — no identifier —
// so this carries no meaningful privacy footprint.

export interface FirstTouch {
  source: string | null
  medium: string | null
  campaign: string | null
  referrer: string | null
  landing_page: string | null
  ts: string
}

const KEY = 'etsm_attr'
export const STAMPED_KEY = 'etsm_attr_stamped'

function isExternalReferrer(ref: string): boolean {
  if (!ref) return false
  try {
    return new URL(ref).host !== window.location.host
  } catch {
    return false
  }
}

// Record the first touch once: only when the landing URL carries utm params or
// the visitor arrived from an external site.
export function captureFirstTouch(): void {
  try {
    if (localStorage.getItem(KEY)) return
    const params = new URLSearchParams(window.location.search)
    const source = params.get('utm_source')
    const medium = params.get('utm_medium')
    const campaign = params.get('utm_campaign')
    const referrer = document.referrer || ''
    if (!source && !medium && !campaign && !isExternalReferrer(referrer)) return
    const touch: FirstTouch = {
      source,
      medium,
      campaign,
      referrer: referrer || null,
      landing_page: window.location.pathname,
      ts: new Date().toISOString(),
    }
    localStorage.setItem(KEY, JSON.stringify(touch))
  } catch {}
}

export function getFirstTouch(): FirstTouch | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as FirstTouch) : null
  } catch {
    return null
  }
}
