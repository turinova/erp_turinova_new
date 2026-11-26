import assert from 'node:assert/strict'
import { test } from 'node:test'

import { classifyShiftDeviation, computeDaySplit } from './day-split'

const off = {
  enabled: false,
  graceMinutes: 15,
  roundingMinutes: 15,
  roundingMode: 'floor' as const,
  dailyCapMinutes: 180
}
const emp = {
  shiftStart: '07:30',
  shiftEnd: '17:00',
  overtime: off,
  earlyOvertime: {
    ...off,
    triggerTime: null,
    payUntilTime: null,
    maxMinutes: 30,
    graceMinutes: 0,
    dailyCapMinutes: 120
  }
}
const day = (arrival: string, departure: string, extra: Partial<Parameters<typeof computeDaySplit>[0]> = {}) =>
  computeDaySplit({
    arrival,
    departure,
    lunchStart: '12:00',
    lunchEnd: '12:30',
    weekend: false,
    graceMinutes: 10,
    employee: emp,
    ...extra
  })

test('teljes műszak 7:30–17:00, 30 perc ebéd → 8 óra + 1 óra túlóra', () => {
  assert.deepEqual(day('07:30', '17:00'), { normal: 480, overtime: 60, weekend: 0 })
})

test('türelmi idő: 7:39 érkezés és 16:51 távozás a műszak széléhez igazít', () => {
  assert.deepEqual(day('07:39', '16:51'), { normal: 480, overtime: 60, weekend: 0 })
})

test('korai érkezés / késői távozás műszakon kívül nem számít, ha nincs túlóra bekapcsolva', () => {
  assert.deepEqual(day('07:10', '17:01'), { normal: 480, overtime: 60, weekend: 0 })
  assert.deepEqual(day('06:00', '19:00'), { normal: 480, overtime: 60, weekend: 0 })
})

test('türelmen túli késés a tényleges időtől számít', () => {
  assert.deepEqual(day('07:45', '17:00'), { normal: 480, overtime: 45, weekend: 0 })
})

test('bekapcsolt műszak utáni túlóra hozzáadódik', () => {
  const r = day('07:30', '18:00', {
    employee: { ...emp, overtime: { ...off, enabled: true } }
  })
  assert.deepEqual(r, { normal: 480, overtime: 60 + 45, weekend: 0 })
})

test('hétvégén a bent töltött idő külön, műszakra nem vág', () => {
  assert.deepEqual(day('07:00', '11:00', { weekend: true, lunchStart: null, lunchEnd: null }), {
    normal: 0,
    overtime: 0,
    weekend: 240
  })
})

test('műszak nélkül a ledolgozott idő számít', () => {
  const r = day('08:00', '17:30', { employee: { ...emp, shiftStart: null, shiftEnd: null } })
  assert.deepEqual(r, { normal: 480, overtime: 60, weekend: 0 })
})

const dev = (arrival: string, departure: string) =>
  classifyShiftDeviation({ arrival, departure, shiftStart: '07:30', shiftEnd: '17:00', graceMinutes: 10 })?.kind

test('eltérés: türelmen belül rendben, korai távozás kevesebb, ráhagyás több, vegyes', () => {
  assert.equal(dev('07:39', '16:51'), 'ok')
  assert.equal(dev('07:30', '15:30'), 'short')
  assert.equal(dev('07:10', '17:01'), 'long')
  assert.equal(dev('07:50', '18:00'), 'mixed')
})
