/**
 * Run: npx tsx --test src/lib/kiosk/size-limits.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  clampDimensionRaw,
  formatCrossMaxHint,
  formatGrainMaxHint,
  isNearSquare,
  kioskMaxCrossMm,
  kioskMaxGrainMm,
  validateKioskSize
} from './size-limits'

const board = {
  lengthMm: 2800,
  widthMm: 2070,
  trimLeftMm: 10,
  trimRightMm: 10,
  trimTopMm: 10,
  trimBottomMm: 10
}

describe('kiosk size limits (Opti parity)', () => {
  it('max = board − trim', () => {
    assert.equal(kioskMaxGrainMm(board), 2780)
    assert.equal(kioskMaxCrossMm(board), 2050)
  })

  it('clampDimensionRaw caps above max', () => {
    assert.equal(clampDimensionRaw('3000', 2780), '2780')
    assert.equal(clampDimensionRaw('800', 2780), '800')
    assert.equal(clampDimensionRaw('', 2780), '')
  })

  it('hints show trim breakdown', () => {
    assert.equal(
      formatGrainMaxHint(board),
      'Max: 2780 mm (2800 − 10 − 10)'
    )
    assert.equal(
      formatCrossMaxHint(board),
      'Max: 2050 mm (2070 − 10 − 10)'
    )
  })

  it('hard block over max; soft warn under 150', () => {
    const over = validateKioskSize({
      sheet: board,
      grainRaw: '3000',
      crossRaw: '400',
      grainMm: 3000,
      crossMm: 400
    })
    assert.equal(over.hardBlock, true)
    assert.ok(over.hardErrors.some((e) => e.includes('szálirány')))

    const soft = validateKioskSize({
      sheet: board,
      grainRaw: '100',
      crossRaw: '400',
      grainMm: 100,
      crossMm: 400
    })
    assert.equal(soft.hardBlock, false)
    assert.ok(soft.softWarn?.includes('150'))
  })

  it('majdnem négyzet: csak szálirányos lapnál figyelmeztet', () => {
    assert.equal(isNearSquare(600, 560), true)
    assert.equal(isNearSquare(800, 400), false)

    const grained = validateKioskSize({
      sheet: { ...board, grainDirection: true },
      grainRaw: '600',
      crossRaw: '560',
      grainMm: 600,
      crossMm: 560
    })
    assert.ok(grained.softWarn?.includes('négyzet'))
    assert.equal(grained.hardBlock, false)

    const plain = validateKioskSize({
      sheet: board,
      grainRaw: '600',
      crossRaw: '560',
      grainMm: 600,
      crossMm: 560
    })
    assert.equal(plain.softWarn, null)

    const exactSquare = validateKioskSize({
      sheet: { ...board, grainDirection: true },
      grainRaw: '500',
      crossRaw: '500',
      grainMm: 500,
      crossMm: 500
    })
    assert.equal(exactSquare.softWarn, null)
  })
})
