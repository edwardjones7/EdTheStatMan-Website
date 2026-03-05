import type { Metadata } from 'next'
import CTASection from '@/components/CTASection'

export const metadata: Metadata = {
  title: 'Results – EdTheStatMan.com',
  description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
  openGraph: {
    title: 'Results – EdTheStatMan.com',
    description: 'Historical performance of betting systems. Full transparency with year-by-year results, bankroll ROI, and sport-by-sport records.',
  },
}

export default function Results() {
  return (
    <main>
      {/* Page Header */}
      <header className="page-header">
        <div className="container">
          <div className="reveal">
            <span className="section-label">Historical Performance</span>
            <h1 className="page-header__title">Results</h1>
            <p className="page-header__subtitle">Full transparency on our betting systems. Track our year-by-year performance, bankroll ROI, and sport-by-sport records.</p>
          </div>
        </div>
      </header>

      {/* Summary Stat Cards + Chart + Table */}
      <section className="section">
        <div className="container">
          <div className="results-stats-grid stagger-children">
            <div className="results-stat-card">
              <div className="results-stat-card__value" data-count="10.19" data-prefix="+" data-suffix="%" data-decimals="2">0%</div>
              <div className="results-stat-card__label">Total Bankroll</div>
            </div>
            <div className="results-stat-card">
              <div className="results-stat-card__value" data-count="19" data-suffix="-4 ATS">0</div>
              <div className="results-stat-card__label">Super Bowl Record</div>
            </div>
            <div className="results-stat-card">
              <div className="results-stat-card__value" data-count="4" data-suffix=" Sports">0</div>
              <div className="results-stat-card__label">Total Systems Tracked</div>
            </div>
            <div className="results-stat-card">
              <div className="results-stat-card__value" data-count="2026">0</div>
              <div className="results-stat-card__label">Year</div>
            </div>
          </div>

          {/* Results Chart */}
          <div className="results-chart reveal" style={{ marginTop: '48px' }}>
            <div className="results-chart__header">
              <h2 className="results-chart__title">2026 Bankroll Performance</h2>
              <span className="results-chart__value">+10.19%</span>
            </div>
            <div className="chart-bars">
              <div className="chart-bar chart-bar--green" data-height="100" data-value="+3.2%"><span className="chart-bar__tooltip">+3.2%</span></div>
              <div className="chart-bar chart-bar--red" data-height="56" data-value="+1.8%"><span className="chart-bar__tooltip">+1.8%</span></div>
              <div className="chart-bar chart-bar--green" data-height="5" data-value="—"><span className="chart-bar__tooltip">—</span></div>
              <div className="chart-bar chart-bar--red" data-height="5" data-value="—"><span className="chart-bar__tooltip">—</span></div>
              <div className="chart-bar chart-bar--green" data-height="5" data-value="—"><span className="chart-bar__tooltip">—</span></div>
              <div className="chart-bar chart-bar--red" data-height="5" data-value="—"><span className="chart-bar__tooltip">—</span></div>
              <div className="chart-bar chart-bar--green" data-height="5" data-value="—"><span className="chart-bar__tooltip">—</span></div>
              <div className="chart-bar chart-bar--red" data-height="5" data-value="—"><span className="chart-bar__tooltip">—</span></div>
              <div className="chart-bar chart-bar--green" data-height="5" data-value="—"><span className="chart-bar__tooltip">—</span></div>
              <div className="chart-bar chart-bar--red" data-height="5" data-value="—"><span className="chart-bar__tooltip">—</span></div>
              <div className="chart-bar chart-bar--green" data-height="5" data-value="—"><span className="chart-bar__tooltip">—</span></div>
              <div className="chart-bar chart-bar--red" data-height="5" data-value="—"><span className="chart-bar__tooltip">—</span></div>
            </div>
            <div className="chart-labels">
              <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span>
              <span>May</span><span>Jun</span><span>Jul</span><span>Aug</span>
              <span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
            </div>
          </div>

          {/* Year-by-Year Table */}
          <div className="reveal" style={{ marginTop: '64px' }}>
            <span className="section-label">Year-by-Year</span>
            <h2 className="section-title">Historical Results</h2>
            <p className="section-subtitle">Complete records across NFL, College Football, NBA, and College Basketball.</p>
          </div>

          <div className="trends-table-wrap reveal" style={{ marginTop: '32px' }}>
            <table className="trends-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>NFL</th>
                  <th>College Football</th>
                  <th>NBA</th>
                  <th>College Basketball</th>
                  <th>Overall</th>
                  <th>Bankroll ROI</th>
                </tr>
              </thead>
              <tbody className="stagger-children">
                <tr>
                  <td><strong>2026</strong></td>
                  <td>10-34</td>
                  <td>3-3</td>
                  <td>101-108</td>
                  <td>2-0</td>
                  <td>116-145</td>
                  <td><span className="trend-badge trend-badge--win">+10.19%</span></td>
                </tr>
                <tr>
                  <td><strong>2025</strong></td>
                  <td>44-38</td>
                  <td>12-8</td>
                  <td>198-182</td>
                  <td>15-10</td>
                  <td>269-238</td>
                  <td><span className="trend-badge trend-badge--win">+15.2%</span></td>
                </tr>
                <tr>
                  <td><strong>2024</strong></td>
                  <td>38-42</td>
                  <td>8-12</td>
                  <td>175-195</td>
                  <td>12-14</td>
                  <td>233-263</td>
                  <td><span className="trend-badge trend-badge--loss">-4.8%</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CTASection />
    </main>
  )
}
