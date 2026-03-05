'use client'

import { useState } from 'react'

type Sport = 'all' | 'nfl' | 'cfb' | 'nba' | 'cbb'

const TABS: { label: string; value: Sport }[] = [
  { label: 'All Sports', value: 'all' },
  { label: 'NFL', value: 'nfl' },
  { label: 'College Football', value: 'cfb' },
  { label: 'NBA', value: 'nba' },
  { label: 'College Basketball', value: 'cbb' },
]

const SYSTEMS = [
  {
    sport: 'nfl',
    name: 'NFL Betting Systems',
    badge: <span className="trend-badge trend-badge--loss">NFL</span>,
    record: <span className="text-muted">10-34</span>,
    streak: <span className="trend-badge trend-badge--loss">L2</span>,
    status: <span className="text-muted">Season Ended</span>,
  },
  {
    sport: 'cfb',
    name: 'CFB Betting Systems',
    badge: <span className="trend-badge" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--accent-purple)' }}>CFB</span>,
    record: <span className="text-muted">3-3</span>,
    streak: <span className="text-muted">—</span>,
    status: <span className="text-muted">Season Ended</span>,
  },
  {
    sport: 'nba',
    name: 'NBA Betting Systems',
    badge: <span className="trend-badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-gold)' }}>NBA</span>,
    record: <span className="text-muted">101-108</span>,
    streak: <span className="trend-badge trend-badge--win">W1</span>,
    status: <span className="text-green">&#9679; Active — Daily Posts</span>,
  },
  {
    sport: 'cbb',
    name: 'CBB Betting Systems',
    badge: <span className="trend-badge trend-badge--win">CBB</span>,
    record: <span className="text-green">2-0</span>,
    streak: <span className="trend-badge trend-badge--win">W2</span>,
    status: <span className="text-green">&#9679; Active</span>,
  },
]

export default function SportTabsSystem() {
  const [activeTab, setActiveTab] = useState<Sport>('all')

  const visible = SYSTEMS.filter(s => activeTab === 'all' || s.sport === activeTab)

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

      <div className="trends-table-wrap reveal" style={{ marginTop: '24px' }}>
        <table className="trends-table">
          <thead>
            <tr>
              <th>System Name</th>
              <th>Sport</th>
              <th>Record</th>
              <th>Streak</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(row => (
              <tr key={row.sport}>
                <td><strong>{row.name}</strong></td>
                <td>{row.badge}</td>
                <td>{row.record}</td>
                <td>{row.streak}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
