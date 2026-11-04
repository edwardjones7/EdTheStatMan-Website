/**
 * The EdTheStatMan mark: a block-drawn E with an amber cursor bar beside it
 * (brand refresh, Nov 2026). Geometry, not type, so it renders identically
 * everywhere and stays crisp at favicon size.
 *
 * `bare` is the mark alone, for our own dark ground (header, footer).
 * `tile` sits it on a rounded square, for places whose background is not
 * ours. The same paths live in app/icon.svg and brand/*.svg; change all of
 * them together.
 */
export const MARK_E = 'M24 28 H58 V37 H35 V45.5 H54 V54.5 H35 V63 H58 V72 H24 Z'
export const MARK_INK = '#E9EDF0'
export const MARK_AMBER = '#F0B44C'

export default function BrandMark({
  size = 28,
  variant = 'bare',
  title,
  className,
}: {
  size?: number
  variant?: 'bare' | 'tile'
  /** Accessible name. Omit when a visible "EdTheStatMan" sits beside it. */
  title?: string
  className?: string
}) {
  const a11y = title
    ? { role: 'img' as const, 'aria-label': title }
    : { 'aria-hidden': true as const }

  if (variant === 'tile') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className={className} {...a11y}>
        <rect x="1" y="1" width="98" height="98" rx="22" fill="#18212A" stroke="#2B3743" strokeWidth="2" />
        <path d={MARK_E} fill={MARK_INK} />
        <rect x="65" y="28" width="11" height="44" fill={MARK_AMBER} />
      </svg>
    )
  }

  // Cropped to the mark itself (52 x 44 on the 100 grid).
  return (
    <svg width={Math.round(size * 52 / 44)} height={size} viewBox="24 28 52 44" className={className} {...a11y}>
      <path d={MARK_E} fill={MARK_INK} />
      <rect x="65" y="28" width="11" height="44" fill={MARK_AMBER} />
    </svg>
  )
}
