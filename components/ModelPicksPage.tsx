'use client'

import type { ModelPicksContent } from '@/lib/site-content'
import type { TodaysBet } from './TodaysBets'
import type { LockedBetTeaser } from '@/lib/teaser'
import TodaysBets from './TodaysBets'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { IconChartBar, IconTrendUp, IconNews } from './Icons'

interface Props {
  rows: TodaysBet[]
  isAdmin: boolean
  userTier: string | null
  isMember: boolean
  /** Picks withheld from a non-member. */
  lockedCount?: number
  /** Redacted stand-ins for those picks — date/sport/result only. */
  lockedBets?: LockedBetTeaser[]
  /** Edge picks withheld from everyone below elite — members included. */
  eliteLockedBets?: LockedBetTeaser[]
  editMode?: boolean
  headerContent: ModelPicksContent
  onHeaderEdit?: (updates: Partial<ModelPicksContent>) => void
  resetKey?: number
}

export default function ModelPicksPage({
  rows, isAdmin, userTier, isMember, lockedCount = 0, lockedBets = [], eliteLockedBets = [], editMode = false, headerContent, onHeaderEdit, resetKey = 0,
}: Props) {
  return (
    <>
      {/* Picks Table */}
      <TodaysBets
        rows={rows}
        isAdmin={isAdmin}
        userTier={userTier}
        isMember={isMember}
        lockedCount={lockedCount}
        lockedBets={lockedBets}
        eliteLockedBets={eliteLockedBets}
        editMode={editMode}
        headerContent={headerContent}
        onHeaderEdit={onHeaderEdit}
        resetKey={resetKey}
      />

      {/* Below-table content. The CTA that used to close this section now
          closes the whole page, under the results. */}
      <section className="section">
        <div className="container">

          {/* Info Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
          }}>
            <InfoCard
              icon={IconChartBar}
              title="Backed by Systems"
              text="Every pick is driven by data-backed betting systems with tracked records across NFL, NBA, College Football, and College Basketball."
              href="/vault/systems"
              linkText="View Betting Systems"
            />
            <InfoCard
              icon={IconTrendUp}
              title="Trend-Informed"
              text="Picks factor in ATS records, over/under patterns, and situational edges uncovered through detailed trend analysis."
              href="/vault/trends"
              linkText="View Betting Trends"
            />
            <InfoCard
              icon={IconNews}
              title="Full Transparency"
              text="Every play is tracked and posted to results. Check our historical performance with year-by-year records and bankroll ROI."
              href="/portfolio/performance"
              linkText="View Results"
            />
          </div>

        </div>
      </section>
    </>
  )
}

function InfoCard({ icon: Icon, title, text, href, linkText }: {
  icon: ComponentType<{ size?: number }>; title: string; text: string; href: string; linkText: string
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '28px 24px',
    }}>
      <div style={{ marginBottom: '12px', color: 'var(--accent-teal)' }}><Icon size={24} /></div>
      <h3 style={{
        fontSize: '1.05rem',
        fontWeight: 700,
        color: 'var(--text-heading)',
        marginBottom: '8px',
      }}>
        {title}
      </h3>
      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '0.9rem',
        lineHeight: 1.7,
        marginBottom: '16px',
      }}>
        {text}
      </p>
      <Link href={href} style={{
        color: 'var(--accent-teal)',
        fontSize: '0.85rem',
        fontWeight: 600,
        textDecoration: 'none',
      }}>
        {linkText} →
      </Link>
    </div>
  )
}
