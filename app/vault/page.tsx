import type { Metadata } from 'next'
import Link from 'next/link'
import CTASection from '@/components/CTASection'
import PricingCards from '@/components/PricingCards'
import RecordStrip from '@/components/RecordStrip'
import LockedTeaserCard from '@/components/LockedTeaserCard'
import { ARCHIVE_SPORTS } from '@/lib/vault-tabs'
import '@/styles/vault-list.css'
import { createCachedClient, DB_TAGS } from '@/lib/supabase/cached'
import { getAccess } from '@/lib/access-server'
import { rowMinTier, compareBySample } from '@/lib/gate'
import { atLeastTier, type Tier } from '@/lib/access'
import { planByKey } from '@/lib/offer'
import { SPORT_LABEL, SPORT_SHORT, type Sport } from '@/lib/desk'
import { IconLock, IconChartBar, IconTarget, IconArrowRight, IconCheckCircle } from '@/components/Icons'

export const dynamic = 'force-dynamic'

// The layout template already appends " – EdTheStatMan.com"; carrying the suffix
// here too produced "The Vault — EdTheStatMan.com – EdTheStatMan.com" in the tab.
export const metadata: Metadata = {
  title: 'The Vault',
  description: 'Every betting system and team trend we track, in one place. Free to browse; the Handicapping Vault opens all of it.',
  alternates: { canonical: 'https://edthestatman.com/vault' },
  openGraph: {
    title: 'The Vault — EdTheStatMan.com',
    description: 'Every betting system and team trend we track, in one place. Free to browse; the Handicapping Vault opens all of it.',
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
    body: 'See the record, the sample size and the win rate on every system and trend — just not the system itself. Start the free Research Desk trial to open all of them.',
    features: ['Record and sample size on every row', 'Sport filters', 'Free Research Desk trial'],
  },
  {
    tier: 'private',
    name: 'Handicapping Vault',
    price: priceLine('private'),
    body: 'The complete libraries, unlocked and filterable. Every system and every team trend we track.',
    features: ['Every system and trend, unlocked', 'Filter by sport, team and situation', 'Sort across the whole Vault'],
  },
  {
    tier: 'desk',
    name: 'The Research Desk',
    price: priceLine('desk'),
    body: 'The whole Vault, plus every game on its own page with the research and the bets attached, plus every Portfolio pick.',
    features: ['The complete Handicapping Vault', 'Every game, researched', 'All EdTheStatBot Portfolio picks'],
  },
]

function priceLine(key: 'private' | 'desk'): string {
  const plan = planByKey(key)
  return plan ? `${plan.month.price} / 30 days · ${plan.year.price} / 365 days` : ''
}

function pctDisplay(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '—'
  return `${Math.round(pct * 100)}%`
}

export default async function VaultLanding() {
  const admin = createCachedClient([DB_TAGS.vault])
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
      archived: ARCHIVE_SPORTS.has(sport),
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
  const all = [
    ...systems.map(r => ({ r, kind: 'system' as const })),
    ...trends.map(r => ({ r, kind: 'trend' as const })),
  ]
  const preview = [...all]
    .sort((a, b) => compareBySample(a.r, b.r))
    .slice(0, 8)
    .map(({ r, kind }) => {
      const required = rowMinTier(r, 'private')
      const open = isAdmin || atLeastTier(userTier, required)
      return {
        id: r.id as string,
        kind,
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
    ({ r }) => !(isAdmin || atLeastTier(userTier, rowMinTier(r, 'private')))
  ).length

  return (
    <main className="vl-page">
      <div className="container vl-full"><div className="vl-wide">
        <header className="vl-head reveal">
          <div className="vl-head__text">
            <span className="vl-kick">The Vault</span>
            <h1 className="vl-title">Where the data lives</h1>
            <p className="vl-sub">
              Every betting system and team trend we track, in one place, with the full
              record attached to each one. The Research Desk and The Portfolio are both
              built on top of it.
            </p>
          </div>
          <nav className="vl-switch" aria-label="Vault library">
            <Link href="/vault/systems">Systems</Link>
            <Link href="/vault/trends">Trends</Link>
          </nav>
        </header>

        <div className="vault-doors reveal vl-doors">
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
          <section className="vl-card vl-section reveal" aria-label="Leagues covered">
            <header className="vl-hd">
              <h2>Leagues covered</h2>
              <small>Rows in the library</small>
            </header>
            <div className="vl-cover">
              {coverage.filter(c => !c.archived).map(c => (
                <span className="vl-cover__pill" key={c.sport}>
                  {c.label}
                  <b>{c.count.toLocaleString()}</b>
                </span>
              ))}
              {coverage.some(c => c.archived) && (
                <span className="vl-cover__archive">
                  Archive, not on the Research Desk:{' '}
                  {coverage.filter(c => c.archived).map(c => `${c.label} ${c.count}`).join(' · ')}
                </span>
              )}
            </div>
          </section>
        )}

        {preview.length > 0 && (
          <section className="vl-card vl-section reveal" aria-labelledby="vl-peek-title">
            <header className="vl-hd">
              <h2 id="vl-peek-title">Deepest samples on file</h2>
              <small>Biggest sample first</small>
            </header>
            <p className="vl-card__note">
              The longest-running rows in the library. Locked rows still show you the
              record, the sample and the win rate; you just don&apos;t get the rule.
            </p>
            <div className="vl-peek">
              {preview.map(row => row.open ? (
                <div className={`sys-row-card sys-row-card--${row.sport} vl-open`} key={row.id}>
                  <div className="vl-lock__body">
                    <span className="sys-row-card__sport-badge vl-lock__sport">
                      {SPORT_SHORT[row.sport as Sport] ?? row.sport.toUpperCase()}
                    </span>
                    <span className="vl-lock__main">
                      <span className="vl-open__desc">{row.description || 'Untitled system'}</span>
                      {row.code && <span className="vl-lock__meta">{row.code}</span>}
                    </span>
                    <span className="vl-lock__stat">
                      <span className="vl-lock__key">Record</span>
                      <span className={`vl-lock__rec vl-lock__rec--${row.w > row.l ? 'win' : row.w < row.l ? 'loss' : 'flat'}`}>
                        {row.w}-{row.l}{row.t ? `-${row.t}` : ''}
                      </span>
                    </span>
                    <span className="vl-lock__stat vl-lock__stat--pct">
                      <span className="vl-lock__key">Win %</span>
                      <span className={`vl-lock__pct${row.w > row.l ? ' is-win' : ''}`}>{pctDisplay(row.pct)}</span>
                      <RecordStrip w={row.w} l={row.l} t={row.t} />
                    </span>
                    <span />
                  </div>
                </div>
              ) : (
                <LockedTeaserCard
                  key={row.id}
                  teaser={{ id: row.id, sport: row.sport, w: row.w, l: row.l, t: row.t, pct: row.pct }}
                  sportLabel={SPORT_SHORT[row.sport as Sport] ?? row.sport.toUpperCase()}
                  sportClass={row.sport}
                  requiredTier={row.required}
                  noun={row.kind}
                />
              ))}
            </div>

            {lockedTotal > 0 && (
              <Link href="/win" className="vl-card__foot">
                <IconLock size={14} />
                <span>
                  <strong>{lockedTotal.toLocaleString()}</strong> more rows are locked, and
                  you can see every one of their records today.
                </span>
                <IconArrowRight size={14} />
              </Link>
            )}
          </section>
        )}
      </div></div>

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

          {!access.atLeast('desk') && (
            <div style={{ marginTop: '56px' }}>
              <PricingCards
                membership={membership}
                currentTier={userTier}
                expiresAt={access.expiresAt?.toISOString() ?? null}
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
