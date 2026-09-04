/**
 * EdTheStatBot's face.
 *
 * ONE COMPONENT, four call sites (the FAB, the panel header, every assistant
 * message, and the typing indicator). The boundary is the point: swapping this
 * drawn mark for a real image later is a one-file change and every call site
 * follows automatically.
 *
 * DELIBERATELY NOT THE LOGO. public/logo.png is the company's mark and already
 * renders in the nav and the footer; a third instance in the corner reads as
 * branding rather than as a character, and he is a named analyst, not a widget.
 *
 * DELIBERATELY DRAWN, NOT RASTER. He has to be legible at 26px inside a message
 * row and 52px in the FAB, in both themes. A 272px PNG scaled to 26px is muddy,
 * and next.config.js sets `images: { unoptimized: true }`, so next/image would
 * ship the full file at every size for nothing.
 */

interface Props {
  /** Outer diameter in px. 26 in message rows, 34 in the header, 30 in the FAB. */
  size?: number
  /**
   * Draw the gradient disc behind the face.
   *
   * Off inside the FAB, which already IS a gradient circle -- painting a second
   * one inside the first produces a visible ring.
   */
  disc?: boolean
  className?: string
}

export default function StatBotAvatar({ size = 32, disc = true, className }: Props) {
  // The face is drawn on a 24x24 grid to match every icon in Icons.tsx, then
  // inset when it sits on a disc so it does not touch the edge.
  const inner = disc ? Math.round(size * 0.62) : size

  const face = (
    <svg
      width={inner}
      height={inner}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Head. Squarer than a circle so he reads as built rather than drawn. */}
      <rect x="3.5" y="7" width="17" height="12.5" rx="3.5" />
      {/* Antenna. The one asymmetric flourish, so he is not just a rounded box. */}
      <path d="M12 7V4" />
      <circle cx="12" cy="2.9" r="1.35" fill="currentColor" stroke="none" />
      {/* Eyes, filled so they survive being scaled to 16px. */}
      <circle cx="9" cy="12.4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12.4" r="1.5" fill="currentColor" stroke="none" />
      {/* Not a smile -- a baseline with an uptick. He reads a chart for a living. */}
      <path d="M8.6 16.4h2.2l1.5-2 1.6 2h1.5" />
    </svg>
  )

  if (!disc) return face

  return (
    <span
      className={className ? `statbot-avatar ${className}` : 'statbot-avatar'}
      style={{ width: size, height: size }}
    >
      {face}
    </span>
  )
}
