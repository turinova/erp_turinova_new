import assert from 'node:assert/strict'
import test from 'node:test'

import { getNevnap, nevnapFor } from './nevnapok'

test('minden napnak van névnapja (nem szökőév)', () => {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  days.forEach((n, i) => {
    for (let d = 1; d <= n; d++) assert.ok(nevnapFor(2026, i + 1, d).length > 0, `${i + 1}-${d}`)
  })
  assert.deepEqual(nevnapFor(2026, 13, 1), [])
})

test('ismert napok', () => {
  assert.deepEqual(nevnapFor(2026, 11, 26), ['Virág'])
  assert.deepEqual(nevnapFor(2026, 12, 31), ['Szilveszter'])
  assert.deepEqual(nevnapFor(2026, 3, 19), ['József', 'Bánk'])
})

test('szökőév eltolás', () => {
  assert.deepEqual(nevnapFor(2026, 2, 24), ['Mátyás'])
  assert.deepEqual(nevnapFor(2028, 2, 24), [])
  assert.deepEqual(nevnapFor(2028, 2, 25), ['Mátyás'])
  assert.deepEqual(nevnapFor(2028, 2, 28), ['Ákos', 'Bátor'])
  assert.deepEqual(nevnapFor(2028, 2, 29), ['Elemér'])
  assert.deepEqual(nevnapFor(2028, 2, 23), ['Alfréd'])
})

test('budapesti éjfél szerint vált', () => {
  assert.deepEqual(getNevnap(new Date('2026-11-25T22:59:00Z')), ['Katalin'])
  assert.deepEqual(getNevnap(new Date('2026-11-25T23:01:00Z')), ['Virág'])
})
