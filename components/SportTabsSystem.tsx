'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { BettingSystem } from './AdminSystemsTab'

type Sport = 'all' | 'nfl' | 'cfb' | 'nba' | 'cbb'

interface Props {
  systems: BettingSystem[]
  userTier: string | null
  isAdmin?: boolean
}

const TABS: { label: string; value: Sport }[] = [
  { label: 'All Sports', value: 'all' },
  { label: 'NFL', value: 'nfl' },
  { label: 'College Football', value: 'cfb' },
  { label: 'NBA', value: 'nba' },
  { label: 'College Basketball', value: 'cbb' },
]

const SPORT_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  nba: { bg: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-gold)', label: 'NBA' },
  cbb: { bg: 'rgba(52, 211, 153, 0.1)', color: 'var(--accent-cyan)', label: 'CBB' },
  nfl: { bg: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', label: 'NFL' },
  cfb: { bg: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-purple)', label: 'CFB' },
}

function pctDisplay(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '—'
  return `${Math.round(pct * 100)}%`
}

export default function SportTabsSystem({ systems, userTier, isAdmin = false }: Props) {
  const [activeTab, setActiveTab] = useState<Sport>('all')

  const isPaid = userTier === 'basic' || userTier === 'premium'
  const isLoggedOut = userTier === null

  const visible = systems.filter(s => activeTab === 'all' || s.sport === activeTab)

  if (systems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
        No betting systems available yet. Check back soon.
      </div>
    )
  }

  return (
    <>
      <div className="sport-tabs reveal" style={{ marginTop: '32px' }}>
        {TABS.map(tab => (
          <button
            key={tab.value}
            className={`sport-tab${activeTab === tab.value ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="content-gate-wrap reveal" style={{ marginTop: '24px' }}>
        <div className={isLoggedOut ? 'content-gate-blurred' : ''}>
          <div className="trends-table-wrap">
            <table className="trends-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Sport</th>
                  <th>Line</th>
                  <th>Season</th>
                  <th>Type</th>
                  <th>W-L-T</th>
                  <th>Pct</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(row => {
                  const locked = !isPaid && !row.is_free
                  const inactive = !row.is_active
                  const style = SPORT_STYLE[row.sport] ?? { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', label: row.sport.toUpperCase() }
                  const winning = row.w > row.l
                  return (
                    <tr
                      key={row.id}
                      className={locked ? 'trends-row--locked' : ''}
                      style={inactive && isAdmin ? { opacity: 0.4 } : undefined}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{row.description || <em style={{ color: 'var(--text-muted)' }}>—</em>}</span>
                          {locked && <span className="row-lock-badge">Members Only</span>}
                          {inactive && isAdmin && (
                            <span className="admin-badge admin-badge--muted" style={{ fontSize: '0.7rem' }}>Inactive</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="trend-badge" style={{ background: style.bg, color: style.color }}>
                          {style.label}
                        </span>
                      </td>
                      <td className="text-muted">{locked ? '—' : (row.line || '—')}</td>
                      <td className="text-muted">{locked ? '—' : (row.season || '—')}</td>
                      <td className="text-muted">{locked ? '—' : (row.type || '—')}</td>
                      <td>
                        {locked ? (
                          <span className="text-muted">—</span>
                        ) : winning ? (
                          <span className="text-green">{row.w}-{row.l}-{row.t}</span>
                        ) : row.w < row.l ? (
                          <span className="trend-badge trend-badge--loss">{row.w}-{row.l}-{row.t}</span>
                        ) : (
                          <span className="text-muted">{row.w}-{row.l}-{row.t}</span>
                        )}
                      </td>
                      <td>
                        {locked ? (
                          <span className="trend-locked">&#128274; Upgrade to view</span>
                        ) : (
                          <span className={winning ? 'text-green' : 'text-muted'}>{pctDisplay(row.pct)}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {isLoggedOut && (
          <div className="content-gate-overlay">
            <div className="content-gate-card">
              <div className="content-gate-card__icon">🔒</div>
              <h3 className="content-gate-card__title">Sign in to view betting systems</h3>
              <p className="content-gate-card__desc">
                Free members get access to free-tagged systems. Subscribe for full access.
              </p>
              <div className="content-gate-card__actions">
                <Link href="/login" className="btn btn--primary btn--sm">Sign In</Link>
                <Link href="/signup" className="btn btn--outline btn--sm">Create Free Account</Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {userTier === 'free' && systems.some(s => !s.is_free) && (
        <p className="gate-nudge reveal">
          &#128274; Some systems are for members only.{' '}
          <Link href="/betting-systems#pricing" className="gate-nudge__link">View plans →</Link>
        </p>
      )}
    </>
  )
}
