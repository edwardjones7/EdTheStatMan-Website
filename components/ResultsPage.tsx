'use client'

import EditableText from './EditableText'
import type { ResultsContent, ResultsStatCard, ResultsChartBar, ResultsYearRow } from '@/lib/site-content'

interface Props {
  content: ResultsContent
  editMode?: boolean
  onEdit?: (updates: Partial<ResultsContent>) => void
  resetKey?: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

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
        color: 'var(--accent-cyan)',
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
                background: bar.color === 'green' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                border: `1px solid ${bar.color === 'green' ? '#34d399' : '#f87171'}`,
                color: bar.color === 'green' ? '#34d399' : '#f87171',
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
                    background: row.bankrollType === 'win' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                    border: `1px solid ${row.bankrollType === 'win' ? '#34d399' : '#f87171'}`,
                    color: row.bankrollType === 'win' ? '#34d399' : '#f87171',
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
                  onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
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
          background: 'rgba(52,211,153,0.08)',
          color: 'var(--accent-green)',
          border: '1px solid rgba(52,211,153,0.25)',
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

export default function ResultsPage({ content, editMode, onEdit, resetKey = 0 }: Props) {
  const e = editMode && onEdit

  function et(field: keyof ResultsContent) {
    return e
      ? <EditableText tag="span" value={content[field] as string} onChange={v => onEdit({ [field]: v })} resetKey={resetKey} />
      : content[field] as string
  }

  return (
    <main>
      {/* Page Header */}
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">{et('headerLabel')}</span>
            <h1 className="page-header__title">{et('headerTitle')}</h1>
            <p className="page-header__subtitle">{et('headerSubtitle')}</p>
          </div>
        </div>
      </header>

      {false && (
      <section className="section">
        <div className="container">

          {/* Stat Cards */}
          <div className="results-stats-grid stagger-children">
            {content.statCards.map((card, i) => (
              <div key={i} className="results-stat-card">
                {e ? (
                  <StatCardEditor
                    card={card}
                    onChange={updates => {
                      const statCards = content.statCards.map((c, j) => j === i ? { ...c, ...updates } : c)
                      onEdit({ statCards })
                    }}
                  />
                ) : (
                  <>
                    <StatValue card={card} />
                    <div className="results-stat-card__label">{card.label}</div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Results Chart */}
          {e ? (
            <div style={{ marginTop: '48px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '180px' }}>
                  <span style={labelStyle}>Chart Title</span>
                  <EditableText tag="span" value={content.chartTitle} onChange={v => onEdit({ chartTitle: v })} resetKey={resetKey}
                    style={{ display: 'block', fontSize: '1rem', fontWeight: 700 }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={labelStyle}>Total Value</span>
                  <EditableText tag="span" value={content.chartValue} onChange={v => onEdit({ chartValue: v })} resetKey={resetKey}
                    style={{ display: 'block', fontSize: '1rem', fontWeight: 700, color: 'var(--accent-green)' }} />
                </div>
              </div>
              <ChartBarEditor
                bars={content.chartBars}
                onChange={chartBars => onEdit({ chartBars })}
              />
            </div>
          ) : (
            <div className="results-chart reveal" style={{ marginTop: '48px' }}>
              <div className="results-chart__header">
                <h2 className="results-chart__title">{content.chartTitle}</h2>
                <span className="results-chart__value">{content.chartValue}</span>
              </div>
              <div className="chart-bars">
                {content.chartBars.map((bar, i) => (
                  <div
                    key={i}
                    className={`chart-bar chart-bar--${bar.color}`}
                    data-height={bar.height}
                    data-value={bar.value}
                  >
                    <span className="chart-bar__tooltip">{bar.value}</span>
                  </div>
                ))}
              </div>
              <div className="chart-labels">
                {MONTHS.map(m => <span key={m}>{m}</span>)}
              </div>
            </div>
          )}

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
