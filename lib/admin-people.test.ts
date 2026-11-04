import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  audienceCounts, bucketTotals, buildPeople, buildSourceTable, classify, csvCell, DIRECT, exportRows,
  jobHealth, matchesFilter, periodFigures, sourceLabel, toCsv,
  type AuthFacts, type ProfileRow, type PurchaseRow,
} from './admin-people'

const NOW = Date.parse('2026-11-03T12:00:00Z')
const FUTURE = '2026-11-20T00:00:00.000Z'
const PAST = '2026-10-01T00:00:00.000Z'

function profile(over: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: 'u1', email: 'a@example.com', full_name: 'A', subscription_tier: 'retail',
    subscription_status: null, is_admin: false, stripe_customer_id: null,
    created_at: '2026-11-01T12:00:00+00:00', last_seen_at: null, access_expires_at: null,
    pass_tier: null, pass_expires_at: null, sub_tier: null, sub_current_period_end: null,
    billing_mode: null, discord_user_id: null, desk_trial_ends_at: null, notify_email: true,
    utm_source: null, first_referrer: null, ...over,
  }
}

const sale = (over: Partial<PurchaseRow> = {}): PurchaseRow => ({
  user_id: 'u1', tier: 'desk', amount_cents: 5000, created_at: '2026-11-02T12:00:00+00:00',
  utm_source: null, referrer: null, ...over,
})

const facts = (entries: [string, Partial<AuthFacts>][]) =>
  new Map(entries.map(([id, f]) => [id, { confirmed: true, imported: false, ...f }]))

const liveDesk = { subscription_tier: 'desk', access_expires_at: FUTURE }
const period = { from: '2026-10-05T00:00:00.000Z', to: '2026-11-04T00:00:00.000Z' }

test('a trial is not a sale, even though it writes a Desk tier and an expiry', () => {
  const p = profile({ ...liveDesk, pass_tier: 'desk', pass_expires_at: FUTURE, desk_trial_ends_at: FUTURE })
  assert.equal(classify(p, false, NOW).status, 'trial')
  assert.equal(classify(p, false, NOW).tier, 'desk')
})

test('a pass with no purchase behind it is a comp', () => {
  const p = profile({ ...liveDesk, pass_tier: 'desk', pass_expires_at: FUTURE })
  assert.equal(classify(p, false, NOW).status, 'comp')
  assert.equal(classify(p, true, NOW).status, 'paying')
})

test('an abandoned checkout leaves a Stripe customer id and proves nothing', () => {
  const p = profile({ ...liveDesk, pass_tier: 'desk', pass_expires_at: FUTURE, stripe_customer_id: 'cus_1' })
  assert.equal(classify(p, false, NOW).status, 'comp')
})

test('a live subscription is paying with or without a ledger row', () => {
  const p = profile({ ...liveDesk, sub_tier: 'desk', sub_current_period_end: FUTURE })
  assert.equal(classify(p, false, NOW).status, 'paying')
})

test('a trial member who subscribes reads as paying', () => {
  const p = profile({
    ...liveDesk, pass_tier: 'desk', pass_expires_at: FUTURE, desk_trial_ends_at: FUTURE,
    sub_tier: 'desk', sub_current_period_end: FUTURE,
  })
  assert.equal(classify(p, false, NOW).status, 'paying')
})

test('expired access is not access, whatever the stored column says', () => {
  const p = profile({ subscription_tier: 'private', access_expires_at: PAST })
  assert.deepEqual(classify(p, true, NOW), { status: 'lapsed', tier: 'retail' })
})

test('a finished trial with no sale is trial_ended, not lapsed', () => {
  const p = profile({
    subscription_tier: 'desk', access_expires_at: PAST,
    pass_tier: 'desk', pass_expires_at: PAST, desk_trial_ends_at: PAST,
  })
  assert.equal(classify(p, false, NOW).status, 'trial_ended')
  assert.equal(classify(p, true, NOW).status, 'lapsed')
})

test('admins are their own group and never counted as paying', () => {
  assert.equal(classify(profile({ ...liveDesk, is_admin: true }), false, NOW).status, 'admin')
})

test('a subscriber is confirmed, email on and not an admin', () => {
  const people = buildPeople(
    [
      profile({ id: 'yes' }),
      profile({ id: 'off', notify_email: false }),
      profile({ id: 'bot' }),
      profile({ id: 'admin', is_admin: true }),
    ],
    facts([['yes', {}], ['off', {}], ['bot', { confirmed: false }], ['admin', {}]]),
    [],
    NOW,
  )
  assert.deepEqual(people.filter(p => p.subscriber).map(p => p.id), ['yes'])
})

test('somebody missing from the auth list is treated as unconfirmed', () => {
  const [p] = buildPeople([profile()], new Map(), [], NOW)
  assert.equal(p.confirmed, false)
  assert.equal(p.subscriber, false)
})

test('imports are subscribers but not signups, and keep their own source', () => {
  const people = buildPeople([profile()], facts([['u1', { imported: true }]]), [], NOW)
  assert.equal(people[0].subscriber, true)
  assert.equal(people[0].source, 'WordPress import')
  assert.equal(periodFigures(people, [], period).signups, 0)
})

test('period figures stop at the end of the period', () => {
  const people = buildPeople(
    [
      profile({ id: 'in' }),
      profile({ id: 'after', created_at: '2026-11-05T00:00:00+00:00' }),
      profile({ id: 'before', created_at: '2026-10-01T00:00:00+00:00' }),
      profile({ id: 'bot' }),
    ],
    facts([['in', {}], ['after', {}], ['before', {}], ['bot', { confirmed: false }]]),
    [],
    NOW,
  )
  assert.equal(periodFigures(people, [], period).signups, 1)
})

test('revenue and trials land in their period', () => {
  const trialEnds = '2026-11-08T00:00:00.000Z'
  const people = buildPeople([profile({ desk_trial_ends_at: trialEnds })], facts([['u1', {}]]), [], NOW)
  const f = periodFigures(people, [sale(), sale({ created_at: '2026-01-01T00:00:00+00:00' })], period)
  assert.equal(f.revenueCents, 5000)
  assert.equal(f.sales, 1)
  assert.equal(f.trials, 1)
})

test('spend sums per person', () => {
  const [p] = buildPeople([profile()], facts([['u1', {}]]), [sale(), sale({ amount_cents: 2500 })], NOW)
  assert.equal(p.spentCents, 7500)
})

test('source names: utm beats referrer, and one place gets one name', () => {
  assert.equal(sourceLabel('Twitter', 'https://google.com/'), 'x')
  assert.equal(sourceLabel(null, 'https://t.co/abc'), 'x')
  assert.equal(sourceLabel(null, 'https://www.google.com/search'), 'google')
  assert.equal(sourceLabel(null, 'https://www.edthestatman.com/win'), DIRECT)
  assert.equal(sourceLabel(null, null), DIRECT)
  assert.equal(sourceLabel('', ''), DIRECT)
})

test('the source table merges aliases and follows a sale back to its buyer', () => {
  const people = buildPeople([profile({ utm_source: 'x' })], facts([['u1', {}]]), [], NOW)
  const rows = buildSourceTable(
    [{ source: 't.co', views: 9, visitors: 5 }, { source: 'twitter.com', views: 2, visitors: 1 }],
    people,
    [sale()],
    period,
  )
  assert.equal(rows.length, 1)
  assert.deepEqual(rows[0], { source: 'x', visitors: 6, signups: 1, trials: 0, sales: 1, revenueCents: 5000 })
})

test('visitors are unknown, not zero, until analytics_sources exists', () => {
  const people = buildPeople([profile()], facts([['u1', {}]]), [], NOW)
  assert.equal(buildSourceTable(null, people, [], period)[0].visitors, null)
})

test('CSV cells are quoted and cannot run as formulas', () => {
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
  assert.equal(csvCell('+1'), "'+1")
  assert.equal(csvCell('@me'), "'@me")
  assert.equal(csvCell('Smith, Jo'), '"Smith, Jo"')
  assert.equal(csvCell(null), '')
})

test('the export never includes an unconfirmed row', () => {
  const people = buildPeople(
    [profile({ id: 'real' }), profile({ id: 'bot', email: 'bot@example.com' })],
    facts([['real', {}], ['bot', { confirmed: false }]]),
    [],
    NOW,
  )
  assert.deepEqual(exportRows(people, 'all').map(p => p.id), ['real'])
  assert.deepEqual(exportRows(people, 'unconfirmed'), [])
  assert.ok(!toCsv(exportRows(people, 'all')).includes('bot@example.com'))
})

test('a subscribers export holds only people who can be emailed', () => {
  const people = buildPeople(
    [profile({ id: 'on' }), profile({ id: 'off', notify_email: false })],
    facts([['on', {}], ['off', {}]]),
    [],
    NOW,
  )
  assert.deepEqual(exportRows(people, 'subscribers').map(p => p.id), ['on'])
  assert.equal(exportRows(people, 'all').length, 2)
})

test('audience counts agree with the filters', () => {
  const people = buildPeople([profile(), profile({ id: 'u2' })], facts([['u1', {}]]), [], NOW)
  const counts = audienceCounts(people)
  assert.equal(counts.all, 2)
  assert.equal(counts.subscribers, 1)
  assert.equal(counts.unconfirmed, 1)
  assert.equal(people.filter(p => matchesFilter(p, 'unconfirmed')).length, 1)
})

test('chart buckets use New York days and ignore the outside of the window', () => {
  const days = ['2026-11-01', '2026-11-02', '2026-11-03']
  const totals = bucketTotals(days, [
    { at: '2026-11-02T03:00:00Z', amount: 1 }, // still Nov 1 in New York
    { at: '2026-11-02T18:00:00Z', amount: 2 },
    { at: '2026-11-03T18:00:00Z', amount: 4 },
    { at: '2026-11-05T18:00:00Z', amount: 8 },
    { at: '2026-10-20T18:00:00Z', amount: 16 },
  ])
  assert.deepEqual(totals, [1, 2, 4])
})

test('weekly buckets collect the whole week', () => {
  const weeks = ['2026-10-19', '2026-10-26', '2026-11-02']
  assert.deepEqual(bucketTotals(weeks, [
    { at: '2026-10-30T18:00:00Z', amount: 1 },
    { at: '2026-11-07T18:00:00Z', amount: 1 },
  ]), [0, 1, 1])
})

test('job health: last run decides, and no rows yet is not an alarm', () => {
  const at = (hoursAgo: number) => new Date(NOW - hoursAgo * 3600_000).toISOString()
  const health = jobHealth([
    { job: 'desk-sync', status: 'failed', error: 'boom', ran_at: at(30) },
    { job: 'desk-sync', status: 'ok', error: null, ran_at: at(2) },
    { job: 'x-ingest', status: 'failed', error: 'boom', ran_at: at(2) },
    { job: 'lifecycle', status: 'ok', error: null, ran_at: at(30) },
  ], NOW)
  const state = Object.fromEntries(health.map(h => [h.job, h.state]))
  assert.deepEqual(state, { 'desk-sync': 'ok', 'discord-sync': 'waiting', 'x-ingest': 'failed', lifecycle: 'late' })
})
