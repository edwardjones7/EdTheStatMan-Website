// "My teams": the teams a visitor follows, kept in this browser only.
//
// Deliberately not in the database (Free plan, over quota, and a follow is a
// convenience, not an account feature). Every storage access is wrapped:
// localStorage throws in some private windows and when site data is blocked,
// and a follow star must never take a page down with it.
//
// Components subscribe with onFollowsChange(); a change in another tab arrives
// through the storage event, a change in this tab through a custom event.

export interface FollowedTeam {
  sport: string
  /** Stored upper case, as nfl_games stores it. */
  abbrev: string
  name: string
  logo: string | null
}

const KEY = 'edtsm:follows:v1'
const EVENT = 'edtsm:follows'
const MAX = 24

export function followKey(sport: string, abbrev: string): string {
  return `${sport.toLowerCase()}|${abbrev.toUpperCase()}`
}

export function readFollows(): FollowedTeam[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list.filter(
      (t: any): t is FollowedTeam =>
        t && typeof t.sport === 'string' && typeof t.abbrev === 'string' && typeof t.name === 'string'
    )
  } catch {
    return []
  }
}

function write(list: FollowedTeam[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* storage unavailable: the follow lasts for this page view only */
  }
  try {
    window.dispatchEvent(new CustomEvent(EVENT))
  } catch {
    /* ignore */
  }
}

export function isFollowing(sport: string, abbrev: string): boolean {
  const k = followKey(sport, abbrev)
  return readFollows().some(t => followKey(t.sport, t.abbrev) === k)
}

export function toggleFollow(team: FollowedTeam): boolean {
  const k = followKey(team.sport, team.abbrev)
  const list = readFollows()
  if (list.some(t => followKey(t.sport, t.abbrev) === k)) {
    write(list.filter(t => followKey(t.sport, t.abbrev) !== k))
    return false
  }
  write([{ ...team, sport: team.sport.toLowerCase(), abbrev: team.abbrev.toUpperCase() }, ...list])
  return true
}

export function onFollowsChange(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb() }
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', onStorage)
  }
}
