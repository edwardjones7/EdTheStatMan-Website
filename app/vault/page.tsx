import type { Metadata } from 'next'
import Link from 'next/link'
import CTASection from '@/components/CTASection'
import PricingCards from '@/components/PricingCards'
import RecordStrip from '@/components/RecordStrip'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccess } from '@/lib/access-server'
import { rowMinTier, compareBySample } from '@/lib/gate'
import { atLeastTier, TIER_SHORT_LABEL, type Tier } from '@/lib/access'
import { SPORT_LABEL, SPORT_SHORT, type Sport } from '@/lib/desk'
import { IconLock, IconChartBar, IconTarget, IconArrowRight, IconCheckCircle } from '@/components/Icons'

export const dynamic = 'force-dynamic'

// The layout template already appends " – EdTheStatMan.com"; carrying the suffix
// here too produced "The Vault — EdTheStatMan.com – EdTheStatMan.com" in the tab.
export const metadata: Metadata = {
  title: 'The Vault',
  description: 'Every betting system and team trend we track, in one place. Free, Private and Institutional access levels.',
  alternates: { canonical: 'https://edthestatman.com/vault' },
  openGraph: {
    title: 'The Vault — EdTheStatMan.com',
    description: 'Every betting system and team trend we track, in one place. Free, Private and Institutional access levels.',
    url: 'https://edthestatman.com/vault',
    images: [{ url: '/og-cover.jpg', width: 1200, height: 630 }],
  },
}

const LEVELS: {
  tier: Tier
  name: string
  price: string
  body: string
  features: string[]
}[] = [
  {
    tier: 'retail',
    name: 'Public Intelligence',
    price: 'Free',
    body: 'A curated set of free systems and trends. On everything else you still see the record, the sample size and the win rate — just not the system itself.',
    features: ['Curated free systems', 'Record and sample size on every locked row', 'Sport filters'],
  },
  {
    tier: 'private',
    name: 'Private Intelligence',
    price: '$199/mo · $799 season',
    body: 'The complete libraries, unlocked and filterable. Every system, every team trend, with alerts the moment one triggers.',
    features: ['Every system and trend, unlocked', 'Filter by sport, team and situation', 'Alerts the moment one triggers'],
  },
  {
    tier: 'institutional',
    name: 'Institutional Intelligence',
    price: '$399/mo · $1,499 season',
    body: 'The raw material underneath the conclusions: full row export, a query builder across the whole Vault, an API key, and a backtester for your own systems.',
    features: ['Full row export', 'Query builder across the whole Vault', 'API key', 'Backtester for your own systems'],
  },
]

function pctDisplay(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '—'
  return `${Math.round(pct * 100)}%`
}

export default async function VaultLanding() {
  const admin = createAdminClient()
  const access = await getAccess()
  const { tier: userTier, isAdmin, membership } = access

  // Counts are the honest advertisement: the size of the library is the pitch.
  // select('*') deliberately: naming min_tier explicitly throws
  // "column does not exist" until tier_ladder_02 is applied, which silently
  // zeroes these counts. Nothing here crosses to the client wholesale -- the
  // rows are counted server-side, and the preview below copies its fields one
  // at a time for exactly the reason lib/teaser.ts spells out.
  const [systemsRes, trendsRes] = await Promise.all([
    (admin as any).from('betting_systems').select('*').eq('is_active', true),
    (admin as any).from('betting_trends').select('*').eq('is_active', true),
  ])

  const systems = (systemsRes.data ?? []) as any[]
  const trends = (trendsRes.data ?? []) as any[]
  const freeOf = (rows: any[]) => rows.filter(r => rowMinTier(r, 'private') === 'retail').length

  const doors = [
    {
      href: '/vault/systems',
      icon: <IconChartBar size={22} />,
      name: 'Betting Systems',
      desc: 'Situational edges with the full record attached to each one.',
      total: systems.length,
      free: freeOf(systems),
    },
    {
      href: '/vault/trends',
      icon: <IconTarget size={22} />,
      name: 'Team Trends',
      desc: 'Edges by team, sliced by situation and line.',
      total: trends.length,
      free: freeOf(trends),
    },
  ]

  // Coverage is depth the counts alone don't show: which leagues are actually
  // stocked, biggest library first.
  const perSport = new Map<string, number>()
  for (const r of [...systems, ...trends]) {
    if (!r.sport) continue
    perSport.set(r.sport, (perSport.get(r.sport) ?? 0) + 1)
  }
  const coverage = [...perSport.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sport, count]) => ({
      sport,
      count,
      label: SPORT_LABEL[sport as Sport] ?? sport.toUpperCase(),
    }))

  // A sample of what is actually in here, biggest sample size first.
  //
  // HOUSE RULE (lib/teaser.ts): a locked row is advertised by its RECORD, never
  // by its description -- the description is the betting rule, which is the
  // product. So `description` is only copied onto the preview object when this
  // visitor is entitled to the row; for everyone else it never leaves the
  // server. The code is a label, not the rule, so it rides along either way.
  // Field-by-field on purpose: the source query is select('*') and a spread
  // would ship every present and future column.
  const all = [...systems, ...trends]
  const preview = [...all]
    .sort(compareBySample)
    .slice(0, 6)
    .map(r => {
      const required = rowMinTier(r, 'private')
      const open = isAdmin || atLeastTier(userTier, required)
      return {
        id: r.id as string,
        sport: (r.sport ?? '') as string,
        open,
        required,
        description: open ? ((r.description ?? '') as string) : '',
        code: (r.code ?? '') as string,
        w: (r.w ?? 0) as number,
        l: (r.l ?? 0) as number,
        t: (r.t ?? 0) as number,
        pct: (r.pct ?? null) as number | null,
      }
    })
  const lockedTotal = all.filter(
    r => !(isAdmin || atLeastTier(userTier, rowMinTier(r, 'private')))
  ).length

  return (
    <main>
      <section className="section vault-hero">
        <div className="container">
          <div className="reveal vault-hero__head">
            <span className="section-label">The Vault</span>
            <h1 className="section-title">Where the data lives</h1>
            <p className="section-subtitle" style={{ margin: '0 auto' }}>
              Every betting system and team trend we track, in one place, with the full
              record attached to each one. The Research Desk and The Portfolio are both
              built on top of it.
            </p>
          </div>

          <div className="vault-doors reveal">
            {doors.map(door => (
              <Link href={door.href} className="vault-door" key={door.href}>
                <span className="vault-door__icon">{door.icon}</span>
                <span className="vault-door__count">{door.total.toLocaleString()}</span>
                <span className="vault-door__name">{door.name}</span>
                <p className="vault-door__desc">{door.desc}</p>
                <span className="vault-door__foot">
                  <span className="vault-door__free">{door.free} open to free</span>
                  <span className="vault-door__go">
                    Browse <IconArrowRight size={14} />
                  </span>
                </span>
              </Link>
            ))}
          </div>

          {coverage.length > 0 && (
            <div className="vault-coverage reveal">
              <span className="vault-coverage__label">Leagues covered</span>
              <div className="vault-coverage__list">
                {coverage.map(c => (
                  <span className="vault-coverage__pill" key={c.sport}>
                    {c.label}
                    <span className="vault-coverage__n">{c.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {preview.length > 0 && (
        <section className="section vault-peek-section">
          <div className="container">
            <div className="reveal" style={{ textAlign: 'center' }}>
              <span className="section-label">Inside</span>
              <h2 className="section-title">Deepest samples on file</h2>
              <p className="section-subtitle" style={{ margin: '0 auto' }}>
                The longest-running rows in the library, biggest sample first. Locked rows
                still show you the record — you just don&apos;t get the rule.
              </p>
            </div>

            <ul className="vault-peek reveal">
              {preview.map(row => (
                <li className={`vault-peek__row${row.open ? '' : ' is-locked'}`} key={row.id}>
                  <span className={`vault-peek__sport sport-${row.sport}`}>
                    {SPORT_SHORT[row.sport as Sport] ?? row.sport.toUpperCase()}
                  </span>
                  <span className="vault-peek__desc">
                    {row.open ? (
                      <>
                        <span>{row.description || 'Untitled system'}</span>
                        {row.code && <span className="vault-peek__line">{row.code}</span>}
                      </>
                    ) : (
                      <span className="vault-peek__redacted">
                        <IconLock size={12} />
                        Rule locked · {TIER_SHORT_LABEL[row.required]}
                      </span>
                    )}
                  </span>
                  <span className="vault-peek__record">
                    <span className="vault-peek__wl">
                      {row.w}-{row.l}{row.t ? `-${row.t}` : ''}
                    </span>
                    <RecordStrip w={row.w} l={row.l} t={row.t} />
                  </span>
                  <span className="vault-peek__pct">{pctDisplay(row.pct)}</span>
                </li>
              ))}
            </ul>

            {lockedTotal > 0 && (
              <Link href="/win" className="vault-peek__locked">
                <IconLock size={14} />
                <span>
                  <strong>{lockedTotal.toLocaleString()}</strong> more rows are locked — and
                  you can see every one of their records today.
                </span>
                <IconArrowRight size={14} />
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="section" style={{ background: 'var(--bg-secondary)' }}>
        <div className="container">
          <div className="reveal" style={{ textAlign: 'center' }}>
            <span className="section-label">Access Levels</span>
            <h2 className="section-title">Three ways in</h2>
          </div>

          <div className="vault-levels stagger-children">
            {LEVELS.map(level => {
              const held = access.atLeast(level.tier)
              return (
                <div
                  key={level.tier}
                  className={`vault-level reveal-scale${held ? ' vault-level--held' : ''}`}
                >
                  <div className="vault-level__head">
                    <span className="vault-level__name">{level.name}</span>
                    {held
                      ? <span className="vault-level__badge">Yours</span>
                      : <IconLock size={14} />}
                  </div>
                  <div className="vault-level__price">{level.price}</div>
                  <p className="vault-level__body">{level.body}</p>
                  <ul className="vault-level__features">
                    {level.features.map(f => (
                      <li key={f}>
                        <IconCheckCircle size={14} />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>

          {!access.atLeast('institutional') && (
            <div style={{ marginTop: '56px' }}>
              <PricingCards
                membership={membership}
                currentTier={userTier}
                highlight="private"
              />
            </div>
          )}
        </div>
      </section>

      <CTASection membership={membership} />
    </main>
  )
}
