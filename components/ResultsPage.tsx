'use client'

import EditableText from './EditableText'
import type { ResultsContent, ResultsStatCard, ResultsChartBar, ResultsYearRow } from '@/lib/site-content'
import type { TodaysBet } from './TodaysBets'

interface CalcStats {
  wins: number
  losses: number
  pushes: number
  winPct: number
}

interface SportStat {
  sport: string
  wins: number
  losses: number
  pushes: number
  winPct: number
  form: string[]
}

interface Props {
  content: ResultsContent
  editMode?: boolean
  onEdit?: (updates: Partial<ResultsContent>) => void
  resetKey?: number
  calcStats?: CalcStats
  picks?: TodaysBet[]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Break-even win rate against standard -110 vig. Above this, the model beats the juice.
const BREAK_EVEN = 52.38

// Per-sport badge colors, mirroring the sport accents used on the systems page.
const SPORT_THEME: Record<string, { color: string; bg: string }> = {
  NFL:    { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  NFLPRE: { color: '#7dd3fc', bg: 'rgba(125,211,252,0.12)' },
  CFL:    { color: '#f43f5e', bg: 'rgba(244,63,94,0.12)' },
  CFB:    { color: '#e9c46a', bg: 'rgba(233,196,106,0.12)' },
  NBA:    { color: '#e9c46a', bg: 'rgba(233,196,106,0.12)' },
  WNBA:   { color: '#d98a6f', bg: 'rgba(251,146,60,0.12)' },
  CBB:    { color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)' },
}
const sportTheme = (sport: string) => SPORT_THEME[sport] ?? { color: 'var(--accent-teal)', bg: 'rgba(45,212,191,0.12)' }

const FORM_LEN = 7

// Group settled picks (win/loss/push) by sport and tally a record for each.
// `picks` arrives newest-first, so `form` collects the most recent results per
// sport. Pending picks and sport-less rows are skipped; sports ordered by volume.
function statsBySport(picks: TodaysBet[]): SportStat[] {
  const map = new Map<string, { wins: number; losses: number; pushes: number; form: string[] }>()
  for (const p of picks) {
    if (p.result !== 'win' && p.result !== 'loss' && p.result !== 'push') continue
    const sport = (p.sport ?? '').trim().toUpperCase()
    if (!sport) continue
    const entry = map.get(sport) ?? { wins: 0, losses: 0, pushes: 0, form: [] }
    if (p.result === 'win') entry.wins++
    else if (p.result === 'loss') entry.losses++
    else entry.pushes++
    if (entry.form.length < FORM_LEN) entry.form.push(p.result)
    map.set(sport, entry)
  }
  return [...map.entries()]
    .map(([sport, s]) => ({
      sport,
      ...s,
      winPct: (s.wins + s.losses) > 0 ? (s.wins / (s.wins + s.losses)) * 100 : 0,
    }))
    .sort((a, b) => (b.wins + b.losses + b.pushes) - (a.wins + a.losses + a.pushes))
}

// ── Stat card counter value — uses dangerouslySetInnerHTML so the counter
// animation in ClientScripts can safely set textContent without React tracking
// the child text node (avoids removeChild crash when toggling editMode).
function StatValue({ card }: { card: ResultsStatCard }) {
  return (
    <div
      className="results-stat-card__value"
      data-count={card.count}
      data-prefix={card.prefix || undefined}
      data-suffix={card.suffix || undefined}
      data-decimals={card.decimals || undefined}
      dangerouslySetInnerHTML={{ __html: `0${card.suffix}` }}
    />
  )
}

function StatCardEditor({
  card,
  onChange,
}: {
  card: ResultsStatCard
  onChange: (updates: Partial<ResultsStatCard>) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {/* Value row: prefix + count + suffix */}
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={labelStyle}>Prefix</span>
          <input value={card.prefix} onChange={e => onChange({ prefix: e.target.value })}
            placeholder="+" style={{ ...fieldStyle, width: '40px', textAlign: 'center' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          <span style={labelStyle}>Value</span>
          <input value={card.count} onChange={e => onChange({ count: e.target.value })}
            placeholder="0" style={{ ...fieldStyle, textAlign: 'center', fontWeight: 700 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={labelStyle}>Suffix</span>
          <input value={card.suffix} onChange={e => onChange({ suffix: e.target.value })}
            placeholder="%" style={{ ...fieldStyle, width: '70px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={labelStyle}>Decimals</span>
          <input value={card.decimals} onChange={e => onChange({ decimals: e.target.value })}
            placeholder="0" type="number" min="0" max="4"
            style={{ ...fieldStyle, width: '48px', textAlign: 'center' }} />
        </div>
      </div>
      {/* Label */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={labelStyle}>Label</span>
        <input value={card.label} onChange={e => onChange({ label: e.target.value })}
          style={fieldStyle} />
      </div>
    </div>
  )
}

function ChartBarEditor({
  bars,
  onChange,
}: {
  bars: ResultsChartBar[]
  onChange: (bars: ResultsChartBar[]) => void
}) {
  function patch(i: number, updates: Partial<ResultsChartBar>) {
    onChange(bars.map((b, j) => j === i ? { ...b, ...updates } : b))
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      overflow: 'hidden',
      marginTop: '8px',
    }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(255,255,255,0.02)',
        fontSize: '0.7rem',
        fontWeight: 700,
        color: 'var(--accent-teal)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
      }}>
        Chart Bars (12 months)
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column' as const, gap: '6px' }}>
        {bars.map((bar, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ ...labelStyle, width: '28px', flexShrink: 0 }}>{MONTHS[i]}</span>
            {/* Color toggle */}
            <button
              onClick={() => patch(i, { color: bar.color === 'green' ? 'red' : 'green' })}
              style={{
                background: bar.color === 'green' ? 'rgba(45,212,191,0.15)' : 'rgba(248,113,122,0.15)',
                border: `1px solid ${bar.color === 'green' ? '#2dd4bf' : '#f8717a'}`,
                color: bar.color === 'green' ? '#2dd4bf' : '#f8717a',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '3px 8px',
                width: '52px',
                flexShrink: 0,
              }}
            >
              {bar.color === 'green' ? '▲' : '▼'}
            </button>
            {/* Height */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <input
                type="number" min="0" max="100"
                value={bar.height}
                onChange={e => patch(i, { height: Number(e.target.value) })}
                style={{ ...fieldStyle, width: '56px', textAlign: 'center' }}
              />
              <span style={{ ...labelStyle, flexShrink: 0 }}>%</span>
            </div>
            {/* Tooltip value */}
            <input
              value={bar.value}
              onChange={e => patch(i, { value: e.target.value })}
              placeholder="—"
              style={{ ...fieldStyle, flex: 1 }}
              title="Tooltip value shown on hover"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function TableRowEditor({
  rows,
  onChange,
}: {
  rows: ResultsYearRow[]
  onChange: (rows: ResultsYearRow[]) => void
}) {
  function patch(i: number, updates: Partial<ResultsYearRow>) {
    onChange(rows.map((r, j) => j === i ? { ...r, ...updates } : r))
  }
  function addRow() {
    onChange([...rows, { year: String(new Date().getFullYear()), nfl: '0-0', cfb: '0-0', nba: '0-0', cbb: '0-0', overall: '0-0', bankroll: '+0%', bankrollType: 'win' }])
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, j) => j !== i))
  }

  const cellInput = (value: string, onChange: (v: string) => void, width = '80px') => (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...fieldStyle, width, padding: '4px 6px', fontSize: '0.78rem' }}
    />
  )

  return (
    <div style={{ overflowX: 'auto' as const, marginTop: '8px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.8rem' }}>
        <thead>
          <tr>
            {['Year', 'NFL', 'CFB', 'NBA', 'CBB', 'Overall', 'Bankroll', 'Type', ''].map(h => (
              <th key={h} style={{ padding: '6px 8px', textAlign: 'left' as const, ...labelStyle, borderBottom: '1px solid var(--border)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <td style={{ padding: '4px 8px' }}>{cellInput(row.year, v => patch(i, { year: v }), '56px')}</td>
              <td style={{ padding: '4px 8px' }}>{cellInput(row.nfl, v => patch(i, { nfl: v }))}</td>
              <td style={{ padding: '4px 8px' }}>{cellInput(row.cfb, v => patch(i, { cfb: v }))}</td>
              <td style={{ padding: '4px 8px' }}>{cellInput(row.nba, v => patch(i, { nba: v }))}</td>
              <td style={{ padding: '4px 8px' }}>{cellInput(row.cbb, v => patch(i, { cbb: v }))}</td>
              <td style={{ padding: '4px 8px' }}>{cellInput(row.overall, v => patch(i, { overall: v }), '90px')}</td>
              <td style={{ padding: '4px 8px' }}>{cellInput(row.bankroll, v => patch(i, { bankroll: v }), '72px')}</td>
              <td style={{ padding: '4px 8px' }}>
                <button
                  onClick={() => patch(i, { bankrollType: row.bankrollType === 'win' ? 'loss' : 'win' })}
                  style={{
                    background: row.bankrollType === 'win' ? 'rgba(45,212,191,0.15)' : 'rgba(248,113,122,0.15)',
                    border: `1px solid ${row.bankrollType === 'win' ? '#2dd4bf' : '#f8717a'}`,
                    color: row.bankrollType === 'win' ? '#2dd4bf' : '#f8717a',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    whiteSpace: 'nowrap' as const,
                  }}
                >
                  {row.bankrollType === 'win' ? 'Win' : 'Loss'}
                </button>
              </td>
              <td style={{ padding: '4px 8px' }}>
                <button
                  onClick={() => removeRow(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '2px 4px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#f8717a')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        onClick={addRow}
        style={{
          marginTop: '8px',
          background: 'rgba(45,212,191,0.08)',
          color: 'var(--accent-teal)',
          border: '1px solid rgba(45,212,191,0.25)',
          borderRadius: '6px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: '0.75rem',
          fontWeight: 700,
          padding: '5px 12px',
        }}
      >
        + Add Row
      </button>
    </div>
  )
}

export default function ResultsPage({ content, editMode, onEdit, resetKey = 0, calcStats, picks = [] }: Props) {
  const e = editMode && onEdit
  const sportStats = statsBySport(picks)

  function et(field: keyof ResultsContent) {
    return e
      ? <EditableText tag="span" value={content[field] as string} onChange={v => onEdit!({ [field]: v })} resetKey={resetKey} />
      : content[field] as string
  }

  return (
    <main>
      {sportStats.length > 0 && (
      <section className="section">
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center', marginBottom: '32px' }}>
            <span className="section-label">By Sport</span>
            <h2 className="section-title" style={{ fontSize: '1.8rem', marginBottom: '0' }}>Record by Sport</h2>
            <p className="section-subtitle" style={{ margin: '12px auto 0' }}>
              Win rate per sport. The vertical line marks break-even vs standard <span style={{ fontFamily: 'var(--font-mono)' }}>-110</span> juice ({BREAK_EVEN}%).
            </p>
          </div>

          <div className="perf-sport-grid stagger-children">
            {sportStats.map(s => {
              const theme = sportTheme(s.sport)
              const beatsVig = s.winPct >= BREAK_EVEN
              const accent = beatsVig ? 'var(--accent-teal)' : 'var(--accent-red)'
              const sportTotal = s.wins + s.losses + s.pushes
              return (
                <div key={s.sport} className="perf-sport-card reveal-scale">
                  <div className="perf-sport-card__head">
                    <span className="perf-sport-card__badge" style={{ color: theme.color, background: theme.bg }}>{s.sport}</span>
                    <span
                      className="perf-sport-card__pct"
                      style={{ color: accent }}
                      data-count={s.winPct.toFixed(1)}
                      data-suffix="%"
                      data-decimals="1"
                      dangerouslySetInnerHTML={{ __html: `${s.winPct.toFixed(1)}%` }}
                    />
                  </div>
                  <div className="perf-sport-card__record">
                    {s.wins}-{s.losses}-{s.pushes}
                    <span style={{ color: 'var(--text-muted)' }}> · {sportTotal} {sportTotal === 1 ? 'pick' : 'picks'}</span>
                  </div>
                  <div
                    className="perf-winbar"
                    role="img"
                    aria-label={`${s.sport} win rate ${s.winPct.toFixed(1)} percent, ${beatsVig ? 'above' : 'below'} break-even`}
                  >
                    <div className="perf-winbar__fill" data-width={s.winPct.toFixed(1)} style={{ background: accent }} />
                    <div className="perf-winbar__mark" title={`Break-even vs -110 (${BREAK_EVEN}%)`} />
                  </div>
                  <div className="perf-form" aria-label={`Recent form, oldest to newest: ${[...s.form].reverse().join(', ')}`}>
                    <span className="perf-form__label">Form</span>
                    <div className="perf-form__cells">
                      {[...s.form].reverse().map((r, i) => (
                        <span key={i} className={`perf-form__cell perf-form__cell--${r}`} title={r === 'win' ? 'Win' : r === 'loss' ? 'Loss' : 'Push'}>
                          {r === 'win' ? 'W' : r === 'loss' ? 'L' : 'P'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>
      )}
    </main>
  )
}

const fieldStyle: React.CSSProperties = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border)',
  borderRadius: '5px',
  padding: '5px 8px',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  fontSize: '0.82rem',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  fontWeight: 700,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
}
