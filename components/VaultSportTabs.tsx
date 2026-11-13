'use client'

import '@/styles/vault-list.css'
import { DESK_TABS, ARCHIVE_TABS, isArchiveTab, type VaultTab } from '@/lib/vault-tabs'

interface Props {
  active: VaultTab
  onSelect: (tab: VaultTab) => void
  /** Rows (open + locked) in the archived leagues; the toggle hides when zero. */
  archiveCount?: number
}

/**
 * The Vault's sport filter: the four Desk leagues up front, everything else
 * behind an Archive toggle (lib/vault-tabs.ts).
 */
export default function VaultSportTabs({ active, onSelect, archiveCount }: Props) {
  const inArchive = isArchiveTab(active)
  return (
    <div className="vl-tabs reveal">
      <div className="vl-tabs__row" role="tablist" aria-label="Sport">
        {DESK_TABS.map(tab => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active === tab.value}
            className={`vl-tab${active === tab.value ? ' is-active' : ''}`}
            onClick={() => onSelect(tab.value)}
          >
            {tab.label}
          </button>
        ))}
        {archiveCount !== 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={inArchive}
            aria-expanded={inArchive}
            className={`vl-tab vl-tab--archive${inArchive ? ' is-active' : ''}`}
            onClick={() => onSelect(inArchive ? 'all' : 'archive')}
            title="Leagues the Research Desk does not cover"
          >
            Archive{archiveCount ? <span className="vl-tab__n">{archiveCount}</span> : null}
          </button>
        )}
      </div>
      {inArchive && (
        <div className="vl-tabs__row vl-tabs__row--sub" role="tablist" aria-label="Archived leagues">
          <span className="vl-tabs__note">Not on the Research Desk:</span>
          {ARCHIVE_TABS.map(tab => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active === tab.value}
              className={`vl-tab vl-tab--sub${active === tab.value ? ' is-active' : ''}`}
              onClick={() => onSelect(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
