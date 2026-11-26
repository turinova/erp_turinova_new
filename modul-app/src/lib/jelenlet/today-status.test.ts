import assert from 'node:assert/strict'
import test from 'node:test'

import { classifyToday, minutesSoFar } from './today-status'

const base = {
  arrival: null,
  departure: null,
  absent: false,
  expected: true,
  shiftStart: '07:00',
  nowHm: '13:50',
  events: []
}

test('classifyToday: bent / távozott / távol / szabadnap', () => {
  assert.equal(classifyToday({ ...base, arrival: '06:55' }).status, 'in')
  assert.equal(classifyToday({ ...base, arrival: '06:55', departure: '15:00' }).status, 'left')
  assert.equal(classifyToday({ ...base, absent: true }).status, 'away')
  assert.equal(classifyToday({ ...base, expected: false }).status, 'off')
})

test('classifyToday: késés a műszakkezdés + 10 perc után', () => {
  assert.equal(classifyToday({ ...base, nowHm: '07:05' }).status, 'not_yet')
  assert.equal(classifyToday({ ...base, nowHm: '07:11' }).status, 'late')
})

test('classifyToday: dupla érkezés jelzés', () => {
  const r = classifyToday({
    ...base,
    arrival: '06:55',
    events: [
      { employeeId: 'e', hm: '13:43', type: 'arrival', source: 'rfid' },
      { employeeId: 'e', hm: '06:55', type: 'arrival', source: 'rfid' }
    ]
  })
  assert.deepEqual(r.flags, ['double_arrival'])
})

test('minutesSoFar', () => {
  assert.equal(minutesSoFar('07:00', null, '13:30'), 390)
  assert.equal(minutesSoFar('07:00', '15:00', '18:00'), 480)
  assert.equal(minutesSoFar(null, null, '13:30'), 0)
})
