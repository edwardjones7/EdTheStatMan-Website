'use client'

import type { ModelPicksContent } from '@/lib/site-content'
import type { TodaysBet } from './TodaysBets'
import TodaysBets from './TodaysBets'
import Link from 'next/link'

interface Props {
  rows: TodaysBet[]
  isAdmin: boolean
  userTier: string | null
  editMode?: boolean
  headerContent: ModelPicksContent
  onHeaderEdit?: (updates: Partial<ModelPicksContent>) => void
  resetKey?: number
}

export default function ModelPicksPage({
  rows, isAdmin, userTier, editMode = false, headerContent, onHeaderEdit, resetKey = 0,
}: Props) {
  return (
    <>
      {/* Picks Table */}
      <TodaysBets
        rows={rows}
        isAdmin={isAdmin}
        userTier={userTier}
        editMode={editMode}
        headerContent={headerContent}
        onHeaderEdit={onHeaderEdit}
        resetKey={resetKey}
      />

      {/* Below-table content */}
      <section className="section">
        <div className="container">

          {/* Info Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
            marginBottom: '48px',
          }}>
            <InfoCard
              icon="📊"
              title="Backed by Systems"
              text="Every pick is driven by data-backed betting systems with tracked records across NFL, NBA, College Football, and College Basketball."
              href="/betting-systems"
              linkText="View Betting Systems"
            />
            <InfoCard
              icon="📈"
              title="Trend-Informed"
              text="Picks factor in ATS records, over/under patterns, and situational edges uncovered through detailed trend analysis."
              href="/betting-trends"
              linkText="View Betting Trends"
            />
            <InfoCard
              icon="📋"
              title="Full Transparency"
              text="Every play is tracked and posted to results. Check our historical performance with year-by-year records and bankroll ROI."
              href="/results"
              linkText="View Results"
            />
          </div>

          {/* CTA Banner */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '48px 32px',
            textAlign: 'center',
          }}>
            <h2 style={{
              fontSize: 'clamp(1.4rem, 3vw, 2rem)',
              marginBottom: '12px',
              color: 'var(--text-heading)',
            }}>
              Never Miss a Pick
            </h2>
            <p style={{
              color: 'var(--text-secondary)',
              maxWidth: '540px',
              margin: '0 auto 28px',
              lineHeight: 1.7,
            }}>
              Get instant notifications the moment picks drop. Join our Telegram or Discord for real-time alerts, system updates, and community discussion.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="https://t.me/edthestatman" className="btn btn--primary btn--sm" target="_blank" rel="noopener">
                ⚡ Join Telegram
              </a>
              <a href="https://discord.gg/gqPrVBg4Aw" className="btn btn--secondary btn--sm" target="_blank" rel="noopener">
                💬 Join Discord
              </a>
              {userTier === null && (
                <Link href="/signup" className="btn btn--outline btn--sm">
                  Sign Up Free
                </Link>
              )}
            </div>
          </div>

        </div>
      </section>
    </>
  )
}

function InfoCard({ icon, title, text, href, linkText }: {
  icon: string; title: string; text: string; href: string; linkText: string
}) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      padding: '28px 24px',
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '12px' }}>{icon}</div>
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
        color: 'var(--accent-cyan)',
        fontSize: '0.85rem',
        fontWeight: 600,
        textDecoration: 'none',
      }}>
        {linkText} →
      </Link>
    </div>
  )
}
