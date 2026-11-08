/**
 * The EdTheStatMan mark: the Clean E, a slanted block E in a blue-to-sky
 * gradient (light refresh, Nov 2026). Geometry, not type, so it renders
 * identically everywhere and stays crisp at favicon size.
 *
 * `bare` is the mark alone. `tone` picks the gradient for the ground it sits
 * on: 'navy' (the default: header and footer are navy bands) or 'light'.
 * `tile` puts it on the rounded navy square, for places whose background is
 * not ours. The same path lives in app/icon.svg and brand/*.svg; change all
 * of them together and re-run `npm run brand:export`.
 */
export const MARK_E = 'M24 16H82L76 30H40V43H72L66 57H40V70H82L76 84H24Z'

const GRADIENT = {
  navy: ['#4C9BFF', '#38BDF8'],
  light: ['#1F6FEB', '#0EA5E9'],
} as const

/**
 * Gradient ids are fixed per tone rather than per instance: every instance of
 * a tone defines the identical gradient, so whichever one the browser resolves
 * first paints all of them the same.
 */
function Gradient({ tone }: { tone: keyof typeof GRADIENT }) {
  const [from, to] = GRADIENT[tone]
  return (
    <defs>
      <linearGradient id={`etsm-e-${tone}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={from} />
        <stop offset="1" stopColor={to} />
      </linearGradient>
    </defs>
  )
}

export default function BrandMark({
  size = 28,
  variant = 'bare',
  tone = 'navy',
  title,
  className,
}: {
  /** Height in px. */
  size?: number
  variant?: 'bare' | 'tile'
  tone?: 'navy' | 'light'
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
        <Gradient tone="navy" />
        <rect width="100" height="100" rx="22" fill="#0B1F3A" />
        <g transform="translate(50 50) scale(0.72) translate(-53 -50)">
          <path d={MARK_E} fill="url(#etsm-e-navy)" />
        </g>
      </svg>
    )
  }

  // Cropped to the mark itself (58 x 68 on the 100 grid).
  return (
    <svg width={Math.round(size * 58 / 68)} height={size} viewBox="24 16 58 68" className={className} {...a11y}>
      <Gradient tone={tone} />
      <path d={MARK_E} fill={`url(#etsm-e-${tone})`} />
    </svg>
  )
}
