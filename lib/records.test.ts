import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeRecord, recordsByBook, stakeOf, unitsFor, FREE_RISK, FREE_WIN } from './records'

const row = (o: Record<string, unknown>) => ({ date: '2026-11-20', sport: 'NBA', line: null, show_on_results: true, ...o })

test('a blank free pick is sized at 0.44 to win 0.4, a blank members pick at 1.1 to win 1', () => {
  assert.deepEqual(stakeOf({ is_free: true }), { risk: FREE_RISK, win: FREE_WIN, custom: false })
  assert.deepEqual(stakeOf({ is_free: false }), { risk: 1.1, win: 1, custom: false })
  assert.equal(unitsFor('win', { is_free: true }), 0.4)
  assert.equal(unitsFor('loss', { is_free: true }), -0.44)
})

test("Ed's own 0.44 / 0.4 on a free pick is the default, not a custom size", () => {
  assert.equal(stakeOf({ is_free: true, risk: '0.44', win: '0.4' }).custom, false)
  assert.equal(stakeOf({ is_free: true, risk: '0.43', win: '0.4' }).custom, true)
  assert.equal(stakeOf({ is_free: false, risk: '1.05', win: '1' }).custom, true)
})

test('free picks never move the members record', () => {
  const rows = [
    row({ result: 'win', is_free: false }),
    row({ result: 'loss', is_free: false }),
    row({ result: 'win', is_free: true }),
    row({ result: 'win', is_free: true }),
    row({ result: 'loss', is_free: true }),
  ]
  const books = recordsByBook(rows)
  assert.equal(`${books.members.w}-${books.members.l}`, '1-1')
  assert.equal(books.members.units, -0.1)
  assert.equal(`${books.free.w}-${books.free.l}`, '2-1')
  assert.equal(books.free.units, 0.36)
  assert.equal(computeRecord(rows.filter(r => !r.is_free)).units, books.members.units)
})
