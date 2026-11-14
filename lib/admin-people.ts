// What every number on the admin dashboard means, in one place.
//
// Pure: no database, no clock of its own. The dashboard, the CSV export and the
// tests all go through here, so a word like "subscriber" cannot mean one thing
// on the Overview and another in the file you download.
import { normalizeTier, type Tier } from './access'
import { TRIAL_DAYS } from './offer'
import { isTrialPass } from './trial'

export const DAY_MS = 24 * 60 * 60 * 1000

/** The profile columns this file reads. Named once, selected by the loader. */
export const PEOPLE_COLUMNS =
  'id, email, full_name, subscription_tier, subscription_status, is_admin, stripe_customer_id, ' +
  'created_at, last_seen_at, access_expires_at, pass_tier, pass_expires_at, sub_tier, ' +
  'sub_current_period_end, billing_mode, discord_user_id, desk_trial_ends_at, notify_email, ' +
  'utm_source, first_referrer'

export interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  subscription_tier: string | null
  subscription_status: string | null
  is_admin: boolean
  stripe_customer_id: string | null
  created_at: string
  last_seen_at: string | null
  access_expires_at: string | null
  pass_tier: string | null
  pass_expires_at: string | null
  sub_tier: string | null
  sub_current_period_end: string | null
  billing_mode: string | null
  discord_user_id: string | null
  desk_trial_ends_at: string | null
  notify_email: boolean | null
  utm_source: string | null
  first_referrer: string | null
}

export interface PurchaseRow {
  user_id: string | null
  tier: string
  amount_cents: number
  created_at: string
  utm_source: string | null
  referrer: string | null
}

/** Facts that live in auth.users, which PostgREST cannot join to profiles. */
export interface AuthFacts {
  confirmed: boolean
  imported: boolean
}

export type PersonStatus = 'admin' | 'paying' | 'trial' | 'comp' | 'lapsed' | 'trial_ended' | 'free'

export interface Person extends ProfileRow {
  status: PersonStatus
  /** The rung they can open today. Admin is an overlay, not a rung. */
  tier: Tier
  confirmed: boolean
  imported: boolean
  /** Can be mailed: confirmed, email on, not an admin. */
  subscriber: boolean
  spentCents: number
  source: string
  trialStartedAt: string | null
}

export const DIRECT = 'Direct / unknown'
const IMPORT_SOURCE = 'WordPress import'

/** One name per place. Twitter's short links and its two domains are one source. */
const SOURCE_ALIASES: Record<string, string> = {
  't.co': 'x', 'twitter.com': 'x', 'x.com': 'x', twitter: 'x', 'mobile.twitter.com': 'x',
  'l.facebook.com': 'facebook', 'm.facebook.com': 'facebook', 'facebook.com': 'facebook',
  'google.com': 'google', 'bing.com': 'bing', 'duckduckgo.com': 'duckduckgo',
}

function hostOf(value: string): string {
  const match = value.toLowerCase().match(/^(?:[a-z]+:)?\/\/([^/]+)/)
  return (match ? match[1] : value.toLowerCase()).replace(/^www\./, '').trim()
}

/**
 * The one way a utm tag or referrer becomes a source name. utm wins over the
 * referrer, the same order analytics_sources() uses. A visitor's own click from
 * one page to another is not a source, so the site's own host reads as direct.
 */
export function sourceLabel(utm: string | null | undefined, referrer?: string | null): string {
  const tag = utm?.trim().toLowerCase()
  const raw = tag || (referrer ? hostOf(referrer) : '')
  if (!raw || raw.includes('edthestatman') || raw.startsWith('localhost')) return DIRECT
  return SOURCE_ALIASES[raw] ?? raw
}

function isLive(when: string | null, now: number): boolean {
  return !!when && new Date(when).getTime() > now
}

/**
 * Who somebody is to the business today.
 *
 * - paying: live access backed by a live subscription or a purchase on the
 *   ledger. stripe_customer_id is NOT evidence: checkout creates the customer
 *   before anybody pays, so abandoned checkouts carry one too.
 * - trial: live access that is the 7-day trial, which writes a Desk tier and an
 *   expiry exactly as a sale does. Without this check every trial reads as paid.
 * - comp: live access with neither of the above.
 * - trial_ended: the trial ran out and they never bought.
 * - lapsed: held a paid rung, no access today. Includes comps that ran out,
 *   because the ledger starts in August 2026 and an older buyer has no row in
 *   it: calling them "free" would hide somebody who did once pay.
 *
 * A past buyer on a current comp reads as paying. Nothing stored separates the
 * two, and it is the rarer mistake than the alternatives.
 */
export function classify(p: ProfileRow, hasPurchase: boolean, now: number): { status: PersonStatus; tier: Tier } {
  const stored = normalizeTier(p.subscription_tier)
  const live = stored !== 'retail' && isLive(p.access_expires_at, now)
  const tier: Tier = live ? stored : 'retail'

  if (p.is_admin) return { status: 'admin', tier }

  const onTrialPass = isTrialPass({
    pass_tier: p.pass_tier,
    pass_expires_at: p.pass_expires_at,
    desk_trial_ends_at: p.desk_trial_ends_at,
  })

  if (live) {
    if (p.sub_tier && isLive(p.sub_current_period_end, now)) return { status: 'paying', tier }
    if (onTrialPass) return { status: 'trial', tier }
    return { status: hasPurchase ? 'paying' : 'comp', tier }
  }
  if (stored === 'retail') return { status: 'free', tier }
  return { status: onTrialPass && !hasPurchase ? 'trial_ended' : 'lapsed', tier }
}

export function buildPeople(
  profiles: ProfileRow[],
  auth: Map<string, AuthFacts>,
  purchases: PurchaseRow[],
  now: number,
): Person[] {
  const spent = new Map<string, number>()
  for (const p of purchases) {
    if (p.user_id) spent.set(p.user_id, (spent.get(p.user_id) ?? 0) + p.amount_cents)
  }

  return profiles.map(row => {
    const facts = auth.get(row.id) ?? { confirmed: false, imported: false }
    const { status, tier } = classify(row, spent.has(row.id), now)
    const source = sourceLabel(row.utm_source, row.first_referrer)
    return {
      ...row,
      status,
      tier,
      confirmed: facts.confirmed,
      imported: facts.imported,
      subscriber: facts.confirmed && row.notify_email === true && !row.is_admin,
      spentCents: spent.get(row.id) ?? 0,
      source: facts.imported && source === DIRECT ? IMPORT_SOURCE : source,
      trialStartedAt: row.desk_trial_ends_at
        ? new Date(new Date(row.desk_trial_ends_at).getTime() - TRIAL_DAYS * DAY_MS).toISOString()
        : null,
    }
  })
}

// ── Audience filters ─────────────────────────────────────────────────────────

export const AUDIENCE_FILTERS = [
  'all', 'subscribers', 'paying', 'trial', 'comp', 'lapsed', 'wordpress', 'unconfirmed', 'admin',
] as const
export type AudienceFilter = (typeof AUDIENCE_FILTERS)[number]

export const AUDIENCE_LABEL: Record<AudienceFilter, string> = {
  all: 'All', subscribers: 'Subscribers', paying: 'Paying', trial: 'Trial', comp: 'Comp',
  lapsed: 'Lapsed', wordpress: 'WordPress', unconfirmed: 'Unconfirmed', admin: 'Admin',
}

export function matchesFilter(p: Person, filter: AudienceFilter): boolean {
  switch (filter) {
    case 'all': return true
    case 'subscribers': return p.subscriber
    case 'paying': return p.status === 'paying'
    case 'trial': return p.status === 'trial'
    case 'comp': return p.status === 'comp'
    case 'lapsed': return p.status === 'lapsed' || p.status === 'trial_ended'
    case 'wordpress': return p.imported
    case 'unconfirmed': return !p.confirmed
    case 'admin': return p.is_admin
  }
}

export function parseAudienceFilter(value: string | null | undefined): AudienceFilter | null {
  return (AUDIENCE_FILTERS as readonly string[]).includes(value ?? '') ? (value as AudienceFilter) : null
}

// ── CSV export ───────────────────────────────────────────────────────────────

/**
 * One cell. Quoted for commas and newlines, and a leading = + - @ is defused
 * with an apostrophe: names and utm tags are typed by strangers, and a spreadsheet
 * runs a cell starting with = as a formula.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  const text = value === null || value === undefined ? '' : String(value)
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * Who a filter exports. Never an unconfirmed row: most of those are bots, and a
 * list is only useful if every address on it asked to be there. Other filters
 * keep people who switched email off, with "Can email" saying so.
 */
export function exportRows(people: Person[], filter: AudienceFilter): Person[] {
  return people.filter(p => p.confirmed && matchesFilter(p, filter))
}

export function toCsv(people: Person[]): string {
  const header = ['Email', 'Name', 'Joined', 'Status', 'Can email', 'Source', 'Spent USD']
  const lines = people.map(p => [
    p.email, p.full_name, p.created_at.slice(0, 10), p.status, p.subscriber ? 'yes' : 'no',
    p.source, (p.spentCents / 100).toFixed(2),
  ].map(csvCell).join(','))
  return [header.join(','), ...lines].join('\r\n') + '\r\n'
}

// ── Period figures ───────────────────────────────────────────────────────────

export interface Period { from: string; to: string }

/** Compared as instants: Postgres and toISOString() format the same moment differently. */
function inPeriod(iso: string | null, { from, to }: Period): boolean {
  if (!iso) return false
  const at = Date.parse(iso)
  return at >= Date.parse(from) && at < Date.parse(to)
}

/** A signup is a confirmed, non-admin account that really joined in the period. */
export function isSignupIn(p: Person, period: Period): boolean {
  return p.confirmed && !p.imported && !p.is_admin && inPeriod(p.created_at, period)
}

export interface PeriodFigures {
  signups: number
  trials: number
  newSubscribers: number
  revenueCents: number
  sales: number
}

export function periodFigures(people: Person[], purchases: PurchaseRow[], period: Period): PeriodFigures {
  const sold = purchases.filter(p => inPeriod(p.created_at, period))
  return {
    signups: people.filter(p => isSignupIn(p, period)).length,
    trials: people.filter(p => p.trialStartedAt && inPeriod(p.trialStartedAt, period)).length,
    newSubscribers: people.filter(p => p.subscriber && !p.imported && inPeriod(p.created_at, period)).length,
    revenueCents: sold.reduce((sum, p) => sum + p.amount_cents, 0),
    sales: sold.length,
  }
}

/** Standing counts: who is in each group right now, whatever the range. */
export function audienceCounts(people: Person[]) {
  const count = (f: AudienceFilter) => people.filter(p => matchesFilter(p, f)).length
  return Object.fromEntries(AUDIENCE_FILTERS.map(f => [f, count(f)])) as Record<AudienceFilter, number>
}

// ── Source table ─────────────────────────────────────────────────────────────

export interface TrafficSource { source: string; views: number; visitors: number }

export interface SourceRow {
  source: string
  /** Null until analytics_sources() exists: unknown, not zero. */
  visitors: number | null
  signups: number
  trials: number
  sales: number
  revenueCents: number
}

/**
 * Every source from visit through to money. Labels are merged after going
 * through sourceLabel(), so t.co and twitter.com land on one row. Merged visitor
 * counts are a sum, so a person on both counts twice.
 */
export function buildSourceTable(
  traffic: TrafficSource[] | null,
  people: Person[],
  purchases: PurchaseRow[],
  period: Period,
): SourceRow[] {
  const rows = new Map<string, SourceRow>()
  const row = (source: string) => {
    let r = rows.get(source)
    if (!r) {
      r = { source, visitors: traffic ? 0 : null, signups: 0, trials: 0, sales: 0, revenueCents: 0 }
      rows.set(source, r)
    }
    return r
  }

  for (const t of traffic ?? []) {
    const r = row(sourceLabel(t.source))
    r.visitors = (r.visitors ?? 0) + t.visitors
  }

  const byId = new Map(people.map(p => [p.id, p]))
  for (const p of people) {
    if (isSignupIn(p, period)) row(p.source).signups++
    if (p.trialStartedAt && inPeriod(p.trialStartedAt, period)) row(p.source).trials++
  }
  for (const sale of purchases) {
    if (!inPeriod(sale.created_at, period)) continue
    const own = sourceLabel(sale.utm_source, sale.referrer)
    const r = row(own !== DIRECT ? own : byId.get(sale.user_id ?? '')?.source ?? DIRECT)
    r.sales++
    r.revenueCents += sale.amount_cents
  }

  return Array.from(rows.values()).sort((a, b) =>
    b.revenueCents - a.revenueCents ||
    b.signups - a.signups ||
    (b.visitors ?? 0) - (a.visitors ?? 0) ||
    a.source.localeCompare(b.source),
  )
}

// ── Trend chart ──────────────────────────────────────────────────────────────

function nyDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

/** Sums items into chart buckets, each named by its first day, in NY time. */
export function bucketTotals(
  bucketDates: string[],
  items: { at: string; amount: number }[],
): number[] {
  const totals = bucketDates.map(() => 0)
  if (!bucketDates.length) return totals
  const span = bucketDates.length > 1
    ? Date.parse(bucketDates[1]) - Date.parse(bucketDates[0])
    : DAY_MS
  const end = new Date(Date.parse(bucketDates[bucketDates.length - 1]) + span).toISOString().slice(0, 10)

  for (const item of items) {
    const day = nyDate(item.at)
    if (day < bucketDates[0] || day >= end) continue
    let i = bucketDates.length - 1
    while (bucketDates[i] > day) i--
    totals[i] += item.amount
  }
  return totals
}

// ── Daily jobs ───────────────────────────────────────────────────────────────

/** Must match the names the four cron routes pass to withCronLog(). */
export const CRON_JOBS = ['desk-sync', 'discord-sync', 'x-ingest', 'lifecycle'] as const

export interface JobRun {
  job: string
  status: 'ok' | 'failed'
  error: string | null
  ran_at: string
}

export type JobState = 'ok' | 'failed' | 'late' | 'waiting'

export interface JobHealth {
  job: string
  state: JobState
  lastRun: string | null
  error: string | null
}

/** Daily jobs, so a day plus a little slack. Vercel's Hobby crons drift by up to an hour. */
const LATE_AFTER_MS = 26 * 60 * 60 * 1000

export function jobHealth(runs: JobRun[], now: number): JobHealth[] {
  return CRON_JOBS.map(job => {
    const last = runs
      .filter(r => r.job === job)
      .sort((a, b) => b.ran_at.localeCompare(a.ran_at))[0]
    if (!last) return { job, state: 'waiting' as const, lastRun: null, error: null }
    const late = now - new Date(last.ran_at).getTime() > LATE_AFTER_MS
    return {
      job,
      state: last.status === 'failed' ? 'failed' as const : late ? 'late' as const : 'ok' as const,
      lastRun: last.ran_at,
      error: last.error,
    }
  })
}
