const TEAL_LINE =
  'M0 210 H70 V150 H150 V185 H230 V90 H300 V130 H390 V70 H470 V160 H560 V120 H640 V200 H730 V95 H820 V140 H900 V60 H990 V115 H1080 V175 H1160 V80 H1250 V135 H1330 V220 H1420 V160 H1520 V210 H1600'

const ROSE_LINE =
  'M0 250 H90 V190 H180 V235 H260 V170 H350 V215 H440 V130 H520 V180 H610 V240 H700 V155 H790 V205 H880 V110 H970 V165 H1060 V230 H1150 V140 H1240 V195 H1340 V250 H1440 V225 H1520 V250 H1600'

function ChartPanel({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 1600 320" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`bgfx-fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#2DD4BF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${TEAL_LINE} V320 H0 Z`} fill={`url(#bgfx-fill-${id})`} />
      <path d={ROSE_LINE} fill="none" stroke="#F8717A" strokeOpacity="0.05" strokeWidth="1.5" />
      <path d={TEAL_LINE} fill="none" stroke="#2DD4BF" strokeOpacity="0.1" strokeWidth="1.5" />
    </svg>
  )
}

export default function BackgroundEffects() {
  return (
    <div className="bg-fx">
      <div className="bg-fx__wash"></div>
      <div className="bg-fx__dots"></div>
      <div className="bg-fx__chart">
        <ChartPanel id="a" />
        <ChartPanel id="b" />
      </div>
    </div>
  )
}
