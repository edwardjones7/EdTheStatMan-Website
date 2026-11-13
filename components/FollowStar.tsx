'use client'

import { useEffect, useState } from 'react'
import { isFollowing, onFollowsChange, toggleFollow, type FollowedTeam } from '@/lib/follows'
import '@/styles/chrome.css'

/**
 * Follow / unfollow one team, stored in this browser only (lib/follows.ts).
 * Renders as "Follow" until it has read storage, so server and client markup
 * agree and nothing jumps on hydration beyond the star filling in.
 */
export default function FollowStar({
  team,
  label,
}: {
  team: FollowedTeam
  /** Visible text; defaults to the team's name. */
  label?: string
}) {
  const [on, setOn] = useState(false)

  useEffect(() => {
    const sync = () => setOn(isFollowing(team.sport, team.abbrev))
    sync()
    return onFollowsChange(sync)
  }, [team.sport, team.abbrev])

  const name = label ?? team.name
  return (
    <button
      type="button"
      className={`follow-star${on ? ' is-on' : ''}`}
      aria-pressed={on}
      title={on ? `Unfollow ${team.name}` : `Follow ${team.name} on this device`}
      onClick={() => setOn(toggleFollow(team))}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.36l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93z" />
      </svg>
      {on ? `Following ${name}` : `Follow ${name}`}
    </button>
  )
}
