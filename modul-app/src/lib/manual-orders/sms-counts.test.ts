import assert from 'node:assert/strict'
import { test } from 'node:test'

import { moSmsCounts, type SmsCountItem } from './sms-counts'

const item = (id: string, status: string, name = id, sku: string | null = null): SmsCountItem => ({
  id,
  status,
  name,
  sku,
  unitShortform: 'db'
})

test('átadott + most megjött → minden átvehető, 1/1', () => {
  const c = moSmsCounts([item('a', 'atadva'), item('b', 'megrendelve')], ['b'])
  assert.equal(c.readyCount, 1)
  assert.equal(c.totalCount, 1)
  assert.equal(c.waitingCount, 0)
  assert.equal(c.arrivedCount, 2)
  assert.equal(c.statusText, 'minden termek atveheto')
})

test('egy megjött, egy még úton', () => {
  const c = moSmsCounts([item('a', 'megerkezett'), item('b', 'megrendelve')])
  assert.equal(c.statusText, '1 termek atveheto, 1 meg uton')
  assert.equal(c.totalCount, 2)
})

test('részszállítás: kettébontott tétel egy termék', () => {
  const c = moSmsCounts([item('a', 'megerkezett', 'Csavar', 'X1'), item('b', 'megrendelve', 'Csavar', 'X1')])
  assert.equal(c.totalCount, 1)
  assert.equal(c.readyCount, 1)
  assert.equal(c.waitingCount, 1)
})

test('egyetlen termék', () => {
  assert.equal(moSmsCounts([item('a', 'megrendelve')], ['a']).statusText, 'a termek atveheto')
})
