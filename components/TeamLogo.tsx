import { teamLogoUrl } from '@/lib/logos'

/**
 * A small team logo for dense lists (front page cards, the scores strip).
 * Renders nothing when the abbreviation is not on lib/logos.ts's verified
 * list, so callers can drop it in unconditionally and never show a broken
 * image. Works in server and client components (no hooks).
 */
export default function TeamLogo({ sport, abbrev, size = 16, className = '' }: {
  sport: string
  abbrev: string | null | undefined
  size?: number
  className?: string
}) {
  const src = teamLogoUrl(sport, abbrev)
  if (!src) return null
  return (
    <img
      className={`team-logo ${className}`.trim()}
      src={src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  )
}

/** Whether a logo would render, for callers that swap a fallback in its place. */
export function hasTeamLogo(sport: string, abbrev: string | null | undefined): boolean {
  return teamLogoUrl(sport, abbrev) != null
}
