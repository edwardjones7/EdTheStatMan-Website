/**
 * Cumulative units, pick by pick, on one scale from zero to a round ceiling.
 * Shared by the front page record card and the Results page. Pure SVG drawn on
 * the server; it scales with its container through the viewBox.
 *
 * `spark` draws a bare line for a small card (no axis labels). `gradientId`
 * must be unique on the page when more than one chart renders.
 */
export default function UnitsChart({
  series,
  last,
  className = 'front-chart',
  gradientId = 'front-chart-fill',
  spark = false,
  width,
  height,
  labels,
}: {
  series: number[]
  last: number
  className?: string
  gradientId?: string
  spark?: boolean
  width?: number
  height?: number
  /** Optional first/last x labels ("Sep 4", "Nov 11"). */
  labels?: [string, string]
}) {
  if (series.length < 2) return null
  const W = width ?? (spark ? 160 : 300)
  const H = height ?? (spark ? 40 : 120)
  const L = spark ? 2 : 34, R = spark ? 4 : 8, T = spark ? 4 : 8, B = spark ? 4 : labels ? 22 : 20
  const lo = Math.min(0, ...series), hi = Math.max(0, ...series)
  const step = Math.max(1, Math.ceil((hi - lo) / 3))
  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step || step
  const x = (i: number) => L + (i / (series.length - 1)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B)
  const ticks: number[] = []
  if (!spark) for (let v = min; v <= max + 1e-9; v += step) ticks.push(v)
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  const tone = last >= 0 ? 'var(--up)' : 'var(--down)'
  return (
    <svg
      className={className}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={spark ? 'none' : undefined}
      role="img"
      aria-label={`Units won pick by pick, ending at ${last >= 0 ? 'plus' : 'minus'} ${Math.abs(last)}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone} stopOpacity="0.3" />
          <stop offset="1" stopColor={tone} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,.07)" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{v > 0 ? `+${v}u` : v < 0 ? `−${-v}u` : '0'}</text>
        </g>
      ))}
      {spark && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.12)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
      <path d={`M${x(0)},${y(0)} L${pts.join(' L')} L${x(series.length - 1)},${y(0)} Z`} fill={`url(#${gradientId})`} />
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={tone}
        strokeWidth={spark ? 1.5 : 2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect={spark ? 'non-scaling-stroke' : undefined}
      />
      {!spark && <circle cx={x(series.length - 1)} cy={y(series[series.length - 1])} r="4" fill={tone} />}
      {labels && !spark && (
        <>
          <text x={L} y={H - 4} fontSize="10" fill="var(--text-muted)">{labels[0]}</text>
          <text x={W - R} y={H - 4} fontSize="10" textAnchor="end" fill="var(--text-muted)">{labels[1]}</text>
        </>
      )}
    </svg>
  )
}
