// Team logos for share images (next/og ImageResponse).
//
// ImageResponse fetches an <img src> itself and fails the whole image when the
// fetch does, so a logo is fetched here first, with a short timeout, and handed
// over as a data URL. Any failure (no logo for this team, CDN down, slow) is a
// null, and the card draws the abbreviation in a tile instead.

import { teamLogoUrl } from './logos'

export async function logoDataUrl(sport: string, abbrev: string): Promise<string | null> {
  const url = teamLogoUrl(sport, abbrev)
  if (!url) return null
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      // Logos never change mid-season; one fetch a day per team is plenty.
      next: { revalidate: 86400 },
    } as RequestInit)
    if (!res.ok) return null
    const type = res.headers.get('content-type') ?? 'image/png'
    if (!type.startsWith('image/')) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length === 0 || bytes.length > 600_000) return null
    // btoa, not Buffer: these routes run on the edge runtime.
    let bin = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)))
    }
    return `data:${type};base64,${btoa(bin)}`
  } catch {
    return null
  }
}
