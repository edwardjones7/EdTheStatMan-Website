import Link from 'next/link'
import RecordStrip from './RecordStrip'
import { IconLock } from './Icons'
import { TIER_SHORT_LABEL } from '@/lib/access'
import { SPORT_LABEL, SPORT_SHORT, type Sport } from '@/lib/desk'
import type { VaultKind, VaultRowView } from '@/lib/vault-row'
import '@/styles/seo-desk.css'

/**
 * The body of a single Vault row's page. A server component, and it is handed
 * a VaultRowView rather than a table row on purpose: for a locked viewer the
 * view's `rule` is already null, so there is nothing here that could render
 * the system by mistake.
 */
export default function VaultRowDetail({ kind, row }: { kind: VaultKind; row: VaultRowView }) {
  const sportLabel = SPORT_LABEL[row.sport as Sport] ?? row.sport.toUpperCase()
  const sportShort = SPORT_SHORT[row.sport as Sport] ?? row.sport.toUpperCase()
  const noun = kind === 'systems' ? 'system' : 'trend'
  const sample = row.w + row.l + row.t
  const pct = row.pct === null ? null : Math.round(row.pct * 100)
  const winning = row.w > row.l
  // The list's own upgrade target for this rung, carried into checkout.
  const plan = 'private' as const

  return (
    <section className="section" style={{ paddingBottom: '48px' }}>
      <div className="container" style={{ maxWidth: '820px' }}>
        <Link href={`/vault/${kind}?sport=${encodeURIComponent(row.sport)}`} className="blog-post__back">
          &larr; All {sportShort} {kind}
        </Link>

        <header className="vault-row-head">
          <span className="section-label" style={{ margin: 0 }}>
            The Vault · {sportLabel} {kind === 'systems' ? 'System' : 'Trend'}
          </span>
          <h1 className="vault-row-head__title">
            {row.code}
            {row.team && <span className="vault-row-head__team"> · {row.team}</span>}
          </h1>
          {!row.isActive && <span className="nfl-game-card__draft">Inactive — visible to admins only</span>}
        </header>

        <div className="team-stats" role="list">
          <div className="team-stats__cell" role="listitem">
            <span className={`team-stats__value${winning ? ' is-win' : ''}`}>{row.w}-{row.l}-{row.t}</span>
            <span className="team-stats__label">Record</span>
          </div>
          <div className="team-stats__cell" role="listitem">
            <span className={`team-stats__value${winning ? ' is-win' : ''}`}>{pct === null ? '—' : `${pct}%`}</span>
            <span className="team-stats__label">Win %</span>
          </div>
          <div className="team-stats__cell" role="listitem">
            <span className="team-stats__value">{sample}</span>
            <span className="team-stats__label">Sample (games)</span>
          </div>
        </div>
        <div className="vault-row-strip">
          <RecordStrip w={row.w} l={row.l} t={row.t} />
        </div>

        {row.open ? (
          <article className="vault-row-rule">
            <h2 className="vault-row-rule__title">The {noun}</h2>
            <p className="vault-row-rule__text">{row.rule || 'No description on file.'}</p>
            {row.season && <p className="vault-row-rule__meta">Season: {row.season}</p>}
          </article>
        ) : (
          <div className={'sys-gate-card'} style={{ maxWidth: 'none' }}>
            <div className="sys-gate-card__icon"><IconLock size={30} /></div>
            <h2 className="content-gate-card__title">
              The {noun} behind this record is locked
            </h2>
            <p className="content-gate-card__desc">
              {row.code} is part of the Handicapping Vault.
              The record is public; the {noun} itself opens with the Vault or the Research Desk.
            </p>
            <div className="content-gate-card__actions">
              <Link href={`/win?plan=${plan}&period=year`} className="btn btn--primary">
                Unlock {TIER_SHORT_LABEL[plan]} &rarr;
              </Link>
            </div>
          </div>
        )}

        <p className="desk-attrib">
          Past results do not guarantee future outcomes. If gambling stops being fun, call 1-800-GAMBLER.
        </p>
      </div>
    </section>
  )
}
