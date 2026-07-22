// Thin W/T/L proportion bar with a 52.4% break-even tick (the ATS profitability
// threshold at -110). Renders only real aggregate data — no fake time-series.
interface Props {
  w: number
  l: number
  t?: number
}

const BREAK_EVEN = 52.4

export default function RecordStrip({ w, l, t = 0 }: Props) {
  const total = w + l + t
  if (total === 0) return null
  const winPct = (w / total) * 100
  const tiePct = (t / total) * 100
  const lossPct = (l / total) * 100

  return (
    <div
      className="record-strip"
      title={`${w}-${l}${t ? `-${t}` : ''} · break-even 52.4%`}
      aria-label={`Record ${w} wins, ${l} losses${t ? `, ${t} ties` : ''}`}
    >
      {w > 0 && <div className="record-strip__seg record-strip__seg--win" style={{ width: `${winPct}%` }} />}
      {t > 0 && <div className="record-strip__seg record-strip__seg--tie" style={{ width: `${tiePct}%` }} />}
      {l > 0 && <div className="record-strip__seg record-strip__seg--loss" style={{ width: `${lossPct}%` }} />}
      <div className="record-strip__tick" style={{ left: `${BREAK_EVEN}%` }} />
    </div>
  )
}
