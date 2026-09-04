'use client'

import { useId } from 'react'

/**
 * EdTheStatBot's profile picture.
 *
 * ONE COMPONENT, four call sites (the FAB, the panel header, every assistant
 * message, and the typing indicator). The boundary is the point: swapping this
 * for a raster portrait later is a one-file change and every call site follows.
 *
 * COMPOSED AS A PORTRAIT, not an icon. The subject fills the circle and is
 * cropped at the shoulders, the background sits behind him, and the eyes are
 * the focal point -- that framing is what makes something read as a profile
 * picture rather than a glyph. He is an analyst at a desk, so he has a headset.
 *
 * DRAWN, NOT RASTER. He has to be legible at 26px in a message row and 52px in
 * the FAB, in both themes. A photo scaled to 26px is mud, and next.config.js
 * sets `images: { unoptimized: true }`, so a PNG would ship at full weight for
 * every size. Everything below 30px is deliberately chunky for that reason:
 * the visor and the eyes carry the recognition, the fine detail is a bonus at
 * larger sizes and simply disappears cleanly at small ones.
 */

interface Props {
  /** Rendered diameter in px. 26 in message rows, 34 in the header, 52 in the FAB. */
  size?: number
  className?: string
}

export default function StatBotAvatar({ size = 32, className }: Props) {
  // Gradient ids are document-global, and four of these render at once. Without
  // a unique suffix per instance they collide and every avatar picks up the
  // first one's fills.
  const uid = useId().replace(/:/g, '')
  const bg = `sb-bg-${uid}`
  const body = `sb-body-${uid}`
  const head = `sb-head-${uid}`
  const clip = `sb-clip-${uid}`

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="EdTheStatBot"
    >
      <defs>
        {/* Lit from the upper left, like every other portrait. */}
        <radialGradient id={bg} cx="35%" cy="28%" r="85%">
          <stop offset="0%" stopColor="#123044" />
          <stop offset="100%" stopColor="#071219" />
        </radialGradient>
        <linearGradient id={body} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a8e063" />
          <stop offset="55%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id={head} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#f2fbfa" />
          <stop offset="100%" stopColor="#b9d9d6" />
        </linearGradient>
        {/* The crop. Everything is drawn past the edge and cut to the circle,
            which is what lets the shoulders run off the bottom like a real
            portrait instead of floating inside a frame. */}
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clip})`}>
        <circle cx="50" cy="50" r="50" fill={`url(#${bg})`} />

        {/* Shoulders, running off the bottom edge. */}
        <path d="M50 62c19 0 33 11 37 28v10H13v-10c4-17 18-28 37-28Z" fill={`url(#${body})`} />
        {/* Collar notch, so the head reads as sitting on a body. */}
        <path d="M42 66c2 5 4.5 7.5 8 7.5s6-2.5 8-7.5" fill="none" stroke="#071219"
              strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />

        {/* Antenna. The flourish that stops him being a rounded box. */}
        <path d="M50 20V13" stroke="#a8e063" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="50" cy="10.5" r="4" fill="#a8e063" />

        {/* Head. */}
        <rect x="24" y="20" width="52" height="44" rx="15" fill={`url(#${head})`} />

        {/* Headset: he works a desk. Cans either side, band tucked behind. */}
        <rect x="16.5" y="33" width="9" height="18" rx="4.5" fill="#2dd4bf" />
        <rect x="74.5" y="33" width="9" height="18" rx="4.5" fill="#2dd4bf" />

        {/* Visor. The dark band is what makes the eyes readable at 26px. */}
        <rect x="30" y="31" width="40" height="20" rx="9" fill="#071219" />
        <circle cx="41" cy="41" r="4.6" fill="#2dd4bf" />
        <circle cx="59" cy="41" r="4.6" fill="#2dd4bf" />
        {/* Catchlights. Invisible when small, alive when large. */}
        <circle cx="42.6" cy="39.4" r="1.5" fill="#ecfffb" />
        <circle cx="60.6" cy="39.4" r="1.5" fill="#ecfffb" />

        {/* Not a mouth -- a rising line. He reads charts for a living. */}
        <path d="M40 57.5h5l4-5 4 5h7" fill="none" stroke="#2dd4bf" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* Inner rim, so he holds an edge against both the dark panel and the
          light FAB gradient without needing a border on the element itself. */}
      <circle cx="50" cy="50" r="48.5" fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="3" />
    </svg>
  )
}
