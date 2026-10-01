import test from 'node:test'
import assert from 'node:assert/strict'
import { filterReservations, countApprovedFuture } from '../src/reservationViews.ts'
const now = new Date('2026-09-18T10:00:00').getTime()
const base = { name: 'Drop-off', person: 'Test / 900000001V', station: 'Solar hub' }
const bookings = [
 { ...base, id: 'future', status: 'Approved', startUtc: '2026-09-19T10:00:00', endUtc: '2026-09-19T11:00:00' },
 { ...base, id: 'expired', status: 'Approved', startUtc: '2026-09-17T10:00:00', endUtc: '2026-09-17T11:00:00' },
 { ...base, id: 'done', status: 'Completed', startUtc: '2026-09-18T09:00:00', endUtc: '2026-09-18T09:30:00' },
 { ...base, id: 'pending', status: 'Pending', startUtc: '2026-09-20T23:59:59', endUtc: '2026-09-21T00:30:00' },
 { ...base, id: 'missing', status: 'Cancelled' },
]
const filters = { status: 'All', query: '', from: '', to: '' }
const ids = (f) => filterReservations(bookings, { ...filters, ...f }, now).map((b) => b.id)
test('current excludes closed and expired bookings', () => assert.deepEqual(ids({ status: 'Current' }), ['future', 'pending']))
test('history includes expired approvals and missing-slot cancellations', () => assert.deepEqual(ids({ status: 'History' }), ['expired', 'done', 'missing']))
test('dates refer to local scheduled day and include the entire end day', () => assert.deepEqual(ids({ from: '2026-09-19', to: '2026-09-20' }), ['future', 'pending']))
test('invalid date range produces no results', () => assert.deepEqual(ids({ from: '2026-09-20', to: '2026-09-19' }), []))
test('NIC search ignores case and combines with status', () => assert.deepEqual(ids({ query: ' 900000001v ', status: 'Pending' }), ['pending']))
test('approved future counts exclude past slots and completed bookings', () => assert.equal(countApprovedFuture(bookings, now), 1))
