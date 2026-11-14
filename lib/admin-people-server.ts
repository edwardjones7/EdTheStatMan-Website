// Server half of lib/admin-people.ts: reads the rows, never decides what they mean.
import {
  buildPeople, jobHealth, PEOPLE_COLUMNS,
  type AuthFacts, type JobHealth, type JobRun, type Person, type ProfileRow, type PurchaseRow,
} from '@/lib/admin-people'

const PAGE_SIZE = 1000

async function fetchAll<T>(build: (from: number, to: number) => any): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1)
    // Thrown, not swallowed. Stopping quietly here is how a failed read turns
    // into a dashboard of plausible, wrong, smaller numbers.
    if (error) throw new Error(error.message)
    all.push(...((data ?? []) as T[]))
    if (!data || data.length < PAGE_SIZE) return all
  }
}

/**
 * Whether each account confirmed its email, and whether it came from the
 * WordPress import. Both live in auth.users, which PostgREST does not expose.
 * scripts/import-wp-users.mjs wrote `username` into the metadata and nothing
 * else on the site does, which is the only trace the import left.
 */
async function loadAuthFacts(admin: any): Promise<Map<string, AuthFacts>> {
  const facts = new Map<string, AuthFacts>()
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE })
    if (error) throw new Error(error.message)
    for (const user of data.users) {
      facts.set(user.id, {
        confirmed: !!user.email_confirmed_at,
        imported: !!user.user_metadata?.username,
      })
    }
    if (data.users.length < PAGE_SIZE) return facts
  }
}

export interface PeopleLoad {
  people: Person[]
  purchases: PurchaseRow[]
  /** Set when any read failed. People are then incomplete and must not be trusted. */
  error: string | null
}

export async function loadPeople(admin: any, now = Date.now()): Promise<PeopleLoad> {
  try {
    const [profiles, purchases, auth] = await Promise.all([
      fetchAll<ProfileRow>((from, to) =>
        admin.from('profiles')
          .select(PEOPLE_COLUMNS)
          .order('last_seen_at', { ascending: false, nullsFirst: false })
          .order('id')
          .range(from, to),
      ),
      fetchAll<PurchaseRow>((from, to) =>
        admin.from('purchases')
          .select('user_id, tier, amount_cents, created_at, utm_source, referrer')
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, to),
      ),
      loadAuthFacts(admin),
    ])
    return { people: buildPeople(profiles, auth, purchases, now), purchases, error: null }
  } catch (e: any) {
    console.error(`[admin] people load failed: ${e?.message}`)
    return { people: [], purchases: [], error: e?.message ?? 'Failed to load' }
  }
}

export interface Ops {
  /** Null when the count could not be read: unknown, never zero. */
  pendingPicks: number | null
  ungradedPicks: number | null
  jobs: JobHealth[] | null
  jobsState: 'ok' | 'missing' | 'failed'
  /** Dated unsubscribes, or null until admin_01_dashboard.sql is applied. */
  unsubscribes: string[] | null
}

/** Postgres undefined_table / undefined_column, and PostgREST's schema cache misses. */
function isMissing(error: { code?: string } | null): boolean {
  return ['42P01', '42703', 'PGRST204', 'PGRST205'].includes(error?.code ?? '')
}

const UNGRADED_AFTER_MS = 2 * 24 * 60 * 60 * 1000

export async function loadOps(admin: any, now = Date.now()): Promise<Ops> {
  const [pending, ungraded, runs, unsubs] = await Promise.all([
    admin.from('pick_drafts').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    // created_at, not `date`: `date` is free text, and two days is long enough
    // for any pick posted ahead of its game day to have been played.
    admin.from('todays_bets').select('*', { count: 'exact', head: true })
      .eq('result', 'pending')
      .lt('created_at', new Date(now - UNGRADED_AFTER_MS).toISOString()),
    admin.from('job_runs').select('job, status, error, ran_at')
      .order('ran_at', { ascending: false }).limit(60),
    admin.from('profiles').select('notify_email_off_at')
      .not('notify_email_off_at', 'is', null).limit(5000),
  ])

  return {
    pendingPicks: pending.error ? null : pending.count ?? 0,
    ungradedPicks: ungraded.error ? null : ungraded.count ?? 0,
    jobs: runs.error ? null : jobHealth((runs.data ?? []) as JobRun[], now),
    jobsState: !runs.error ? 'ok' : isMissing(runs.error) ? 'missing' : 'failed',
    unsubscribes: unsubs.error
      ? null
      : (unsubs.data ?? []).map((r: { notify_email_off_at: string }) => r.notify_email_off_at),
  }
}
