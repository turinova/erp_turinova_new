import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildTerminalLogs,
  computeDayFromEvents,
  parseScanTime,
  parseScanType
} from './terminal-v2'

test('parseScanTime: naiv = Budapest falióra', () => {
  assert.deepEqual(parseScanTime('2026-11-09T07:58:12'), {
    workDate: '2026-11-09',
    hm: '07:58',
    hms: '07:58:12',
    utcIso: '2026-11-09T06:58:12.000Z'
  })
  assert.equal(parseScanTime('2026-07-01T07:00:00')?.utcIso, '2026-07-01T05:00:00.000Z')
  assert.equal(parseScanTime('2026-11-09 16:30')?.hm, '16:30')
})

test('parseScanTime: offset / Z → Budapest nap', () => {
  const p = parseScanTime('2026-11-25T23:30:00Z')
  assert.equal(p?.workDate, '2026-11-26')
  assert.equal(p?.hm, '00:30')
})

test('parseScanTime: hibás bemenet', () => {
  assert.equal(parseScanTime('tegnap'), null)
  assert.equal(parseScanTime('2026-02-30T10:00:00'), null)
  assert.equal(parseScanTime(42), null)
})

test('parseScanType', () => {
  assert.deepEqual(parseScanType('arrival_pin'), { base: 'arrival', pin: true })
  assert.deepEqual(parseScanType('departure'), { base: 'departure', pin: false })
  assert.equal(parseScanType('lunch'), null)
})

test('computeDay: első érkezés, utolsó távozás (ebéd ki-be)', () => {
  const day = computeDayFromEvents(null, [
    { scan_type: 'arrival', scan_source: 'rfid', hm: '07:58' },
    { scan_type: 'departure', scan_source: 'rfid', hm: '12:00' },
    { scan_type: 'arrival', scan_source: 'pin', hm: '12:30' },
    { scan_type: 'departure', scan_source: 'pin', hm: '16:31' }
  ])
  assert.deepEqual(day, {
    arrival_time: '07:58',
    departure_time: '16:31',
    arrival_source: 'rfid',
    departure_source: 'pin'
  })
})

test('computeDay: kézi mező nyer, a másik terminálból', () => {
  const day = computeDayFromEvents(
    { arrival_time: '07:00:00', departure_time: null, arrival_source: 'manual', departure_source: null },
    [
      { scan_type: 'arrival', scan_source: 'rfid', hm: '07:40' },
      { scan_type: 'departure', scan_source: 'rfid', hm: '15:00' }
    ]
  )
  assert.deepEqual(day, {
    arrival_time: '07:00',
    departure_time: '15:00',
    arrival_source: 'manual',
    departure_source: 'rfid'
  })
})

test('computeDay: távozás érkezés előtt → nincs távozás', () => {
  const day = computeDayFromEvents(null, [
    { scan_type: 'departure', scan_source: 'rfid', hm: '06:00' },
    { scan_type: 'arrival', scan_source: 'rfid', hm: '07:00' }
  ])
  assert.equal(day.arrival_time, '07:00')
  assert.equal(day.departure_time, null)
})

test('computeDay: régi /scan-ből írt érkezés megmarad', () => {
  const day = computeDayFromEvents(
    { arrival_time: '07:58:00', departure_time: null, arrival_source: 'rfid', departure_source: null },
    [{ scan_type: 'departure', scan_source: 'rfid', hm: '16:00' }]
  )
  assert.equal(day.arrival_time, '07:58')
  assert.equal(day.arrival_source, 'rfid')
  assert.equal(day.departure_time, '16:00')
})

test('buildTerminalLogs: kézi mezők manually_edited sorként', () => {
  const rows = buildTerminalLogs(
    '2026-11-09',
    [{ employee_id: 'e1', scan_time_hms: '07:58:12', scan_type: 'arrival', scan_source: 'pin' }],
    [{ employee_id: 'e2', arrival_time: '08:00:00', departure_time: '16:00:00', arrival_source: 'manual', departure_source: 'manual' }]
  )
  assert.deepEqual(rows, [
    { employee_id: 'e1', scan_time: '2026-11-09T07:58:12', scan_type: 'arrival_pin', manually_edited: false },
    { employee_id: 'e2', scan_time: '2026-11-09T08:00:00', scan_type: 'arrival', manually_edited: true },
    { employee_id: 'e2', scan_time: '2026-11-09T16:00:00', scan_type: 'departure', manually_edited: true }
  ])
})
