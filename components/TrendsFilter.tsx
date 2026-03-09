'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { BettingTrend } from './AdminTrendsTab'

type Sport = 'nfl' | 'cfb' | 'nba' | 'cbb'

interface Props {
  trends: BettingTrend[]
  userTier: string | null
}

const TABS: { label: string; value: Sport }[] = [
  { label: 'NFL', value: 'nfl' },
  { label: 'College Football', value: 'cfb' },
  { label: 'NBA', value: 'nba' },
  { label: 'College Basketball', value: 'cbb' },
]

type TagVariant = 'win' | 'loss' | 'neutral'

function Badge({ label, variant }: { label: string; variant: TagVariant }) {
  if (variant === 'neutral') return <span className="text-muted">{label}</span>
  return <span className={`trend-badge trend-badge--${variant}`}>{label}</span>
}

function AtsCell({ w, l }: { w: number; l: number }) {
  const rec = `${w}-${l}`
  if (w > l) return <span className="trend-badge trend-badge--win">{rec}</span>
  if (w < l) return <span className="trend-badge trend-badge--loss">{rec}</span>
  return <span className="text-muted">{rec}</span>
}

export default function TrendsFilter({ trends, userTier }: Props) {
  const [activeTab, setActiveTab] = useState<Sport>('nba')
  const [search, setSearch] = useState('')

  const isPaid = userTier === 'basic' || userTier === 'premium'
  const isLoggedOut = userTier === null

  // Default tab to first sport that has data
  const availableSports = TABS.map(t => t.value).filter(s => trends.some(t => t.sport === s))

  const visible = trends.filter(row => {
    const sportMatch = row.sport === activeTab
    const searchMatch = !search || row.team.toLowerCase().includes(search.toLowerCase())
    return sportMatch && searchMatch
  })

  if (trends.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
        No betting trends available yet. Check back soon.
      </div>
    )
  }

  return (
    <>
      <div className="sport-tabs reveal" style={{ marginTop: '32px' }}>
        {TABS.map(tab => (
          <button
            key={tab.value}
            className={`sport-tab${activeTab === tab.value ? ' active' : ''}${!availableSports.includes(tab.value) ? ' sport-tab--empty' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="team-search reveal" style={{ marginTop: '24px' }}>
        <input
          type="search"
          className="team-search__input"
          placeholder="Search teams..."
          aria-label="Search teams"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {!isPaid && !isLoggedOut && (
        <p className="reveal text-muted" style={{ fontSize: '0.9rem', marginBottom: '24px' }}>
          Showing free trends per team.{' '}
          <Link href="/betting-systems#pricing" className="gate-nudge__link">Upgrade for full access →</Link>
        </p>
      )}

      <div className="content-gate-wrap">
        <div className={isLoggedOut ? 'content-gate-blurred' : ''}>
          {visible.length > 0 ? (
            <div className="trends-table-wrap reveal">
              <table className="trends-table">
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>ATS Record</th>
                    <th>O/U Record</th>
                    <th>Home ATS</th>
                    <th>Away ATS</th>
                    <th>Trends</th>
                  </tr>
                </thead>
                <tbody className="stagger-children">
                  {visible.map(row => (
                    <tr key={row.id} className="trends-row">
                      <td><strong>{row.team}</strong></td>
                      <td><AtsCell w={row.ats_wins} l={row.ats_losses} /></td>
                      <td><AtsCell w={row.ou_wins} l={row.ou_losses} /></td>
                      <td><AtsCell w={row.home_ats_wins} l={row.home_ats_losses} /></td>
                      <td><AtsCell w={row.away_ats_wins} l={row.away_ats_losses} /></td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                          {row.free_tags.map((tag, i) => (
                            <Badge key={i} label={tag.label} variant={tag.variant} />
                          ))}
                          {row.paid_tag && (
                            isPaid ? (
                              <Badge label={row.paid_tag.label} variant={row.paid_tag.variant} />
                            ) : (
                              <span className="trend-locked">&#128274; Upgrade</span>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="trends-empty reveal" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '1.1rem' }}>
                {availableSports.includes(activeTab)
                  ? 'No teams match your search.'
                  : 'No trends added for this sport yet.'}
              </p>
            </div>
          )}
        </div>

        {isLoggedOut && (
          <div className="content-gate-overlay">
            <div className="content-gate-card">
              <div className="content-gate-card__icon">🔒</div>
              <h3 className="content-gate-card__title">Sign in to view betting trends</h3>
              <p className="content-gate-card__desc">
                Free members see free trends per team. Subscribe for full access to all situational trends.
              </p>
              <div className="content-gate-card__actions">
                <Link href="/login" className="btn btn--primary btn--sm">Sign In</Link>
                <Link href="/signup" className="btn btn--outline btn--sm">Create Free Account</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
