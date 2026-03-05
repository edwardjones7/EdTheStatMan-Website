'use client'

import { useState } from 'react'

type Sport = 'nfl' | 'cfb' | 'nba' | 'cbb'

const TABS: { label: string; value: Sport }[] = [
  { label: 'NFL', value: 'nfl' },
  { label: 'College Football', value: 'cfb' },
  { label: 'NBA', value: 'nba' },
  { label: 'College Basketball', value: 'cbb' },
]

const TRENDS = [
  {
    sport: 'nba',
    team: 'Boston Celtics',
    ats: <span className="trend-badge trend-badge--win">30-18</span>,
    ou: <span className="text-muted">25-23</span>,
    homeAts: <span className="trend-badge trend-badge--win">17-7</span>,
    awayAts: <span className="text-muted">13-11</span>,
    tags: [
      <span key="1" className="trend-badge trend-badge--win">8-2 ATS L10</span>,
      <span key="2" className="trend-badge trend-badge--win">5-1 O/U home</span>,
      <span key="3" className="trend-badge trend-badge--win">12-4 as fav</span>,
      <span key="4" className="trend-locked">&#128274; Unlock with Pro</span>,
    ],
  },
  {
    sport: 'nba',
    team: 'Milwaukee Bucks',
    ats: <span className="trend-badge trend-badge--loss">22-26</span>,
    ou: <span className="trend-badge trend-badge--win">28-20</span>,
    homeAts: <span className="trend-badge trend-badge--win">14-10</span>,
    awayAts: <span className="trend-badge trend-badge--loss">8-16</span>,
    tags: [
      <span key="1" className="trend-badge trend-badge--win">12-8 ATS L20</span>,
      <span key="2" className="trend-badge trend-badge--win">6-2 over away</span>,
      <span key="3" className="trend-badge trend-badge--loss">3-7 as dog</span>,
      <span key="4" className="trend-locked">&#128274; Unlock with Pro</span>,
    ],
  },
  {
    sport: 'nba',
    team: 'Denver Nuggets',
    ats: <span className="trend-badge trend-badge--win">26-22</span>,
    ou: <span className="text-muted">24-24</span>,
    homeAts: <span className="trend-badge trend-badge--win">15-9</span>,
    awayAts: <span className="text-muted">11-13</span>,
    tags: [
      <span key="1" className="trend-badge trend-badge--win">7-3 ATS L10</span>,
      <span key="2" className="trend-badge trend-badge--win">4-2 under home</span>,
      <span key="3" className="trend-badge trend-badge--win">9-5 as fav</span>,
      <span key="4" className="trend-locked">&#128274; Unlock with Pro</span>,
    ],
  },
  {
    sport: 'nba',
    team: 'LA Lakers',
    ats: <span className="text-muted">24-24</span>,
    ou: <span className="trend-badge trend-badge--win">30-18</span>,
    homeAts: <span className="trend-badge trend-badge--win">14-10</span>,
    awayAts: <span className="text-muted">10-14</span>,
    tags: [
      <span key="1" className="trend-badge trend-badge--loss">5-5 ATS L10</span>,
      <span key="2" className="trend-badge trend-badge--win">8-4 over total</span>,
      <span key="3" className="trend-badge trend-badge--win">6-2 home dog</span>,
      <span key="4" className="trend-locked">&#128274; Unlock with Pro</span>,
    ],
  },
  {
    sport: 'nba',
    team: 'Golden State Warriors',
    ats: <span className="trend-badge trend-badge--loss">20-28</span>,
    ou: <span className="trend-badge trend-badge--loss">22-26</span>,
    homeAts: <span className="text-muted">12-12</span>,
    awayAts: <span className="trend-badge trend-badge--loss">8-16</span>,
    tags: [
      <span key="1" className="trend-badge trend-badge--win">6-4 ATS L10</span>,
      <span key="2" className="trend-badge trend-badge--loss">3-7 as dog</span>,
      <span key="3" className="trend-badge trend-badge--loss">4-4 home</span>,
      <span key="4" className="trend-locked">&#128274; Unlock with Pro</span>,
    ],
  },
]

export default function TrendsFilter() {
  const [activeTab, setActiveTab] = useState<Sport>('nba')
  const [search, setSearch] = useState('')

  const visible = TRENDS.filter(row => {
    const sportMatch = row.sport === activeTab
    const searchMatch = !search || row.team.toLowerCase().includes(search.toLowerCase())
    return sportMatch && searchMatch
  })

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

      <p className="reveal text-muted" style={{ fontSize: '0.9rem', marginBottom: '24px' }}>
        Showing 3 of 15+ trends per team. Unlock all trends with a Pro membership.
      </p>

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
                <th>Trend</th>
              </tr>
            </thead>
            <tbody className="stagger-children">
              {visible.map(row => (
                <tr key={row.team} className="trends-row">
                  <td><strong>{row.team}</strong></td>
                  <td>{row.ats}</td>
                  <td>{row.ou}</td>
                  <td>{row.homeAts}</td>
                  <td>{row.awayAts}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      {row.tags}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="trends-empty reveal" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.1rem' }}>No teams match your search. Try a different term or sport.</p>
        </div>
      )}
    </>
  )
}
