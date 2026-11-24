/**
 * Run: npx tsx --test src/lib/kiosk/recolor-cart.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { EMPTY_KIOSK_MACHINING } from './machining'
import {
  applyRecolorCart,
  validateRecolorFit
} from './recolor-cart'
import type { KioskCartLine } from './types'

const boardA = {
  id: 'a',
  name: 'Fehér',
  thicknessMm: 18,
  lengthMm: 2800,
  widthMm: 2070,
  trimLeftMm: 10,
  trimRightMm: 10,
  trimTopMm: 10,
  trimBottomMm: 10
}

const boardB = {
  ...boardA,
  id: 'b',
  name: 'Tölgy'
}

const smallBoard = {
  ...boardA,
  id: 's',
  name: 'Kicsi',
  lengthMm: 600,
  widthMm: 400
}

function line(
  partial: Partial<KioskCartLine> & Pick<KioskCartLine, 'id'>
): KioskCartLine {
  return {
    sheetId: 'a',
    grainMm: 500,
    crossMm: 400,
    quantity: 1,
    machining: { ...EMPTY_KIOSK_MACHINING },
    edgeIds: { top: 'abs-1' },
    label: '',
    lineGross: 0,
    ...partial
  }
}

describe('validateRecolorFit', () => {
  it('rejects lines that exceed target max', () => {
    const result = validateRecolorFit(
      [line({ id: '1', grainMm: 700, crossMm: 300 })],
      smallBoard
    )
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.ok(result.errors.length > 0)
    }
  })

  it('accepts lines that fit', () => {
    assert.equal(validateRecolorFit([line({ id: '1' })], boardB).ok, true)
  })
})

describe('applyRecolorCart', () => {
  const allowed = () => ['abs-1', 'abs-2']

  it('copies lines onto the target sheet', () => {
    const cart = [line({ id: '1' }), line({ id: '2', grainMm: 600 })]
    const result = applyRecolorCart({
      cart,
      sourceSheetId: 'a',
      target: boardB,
      mode: 'copy',
      maxRows: 8,
      allowedTypeIds: allowed
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.cart.length, 4)
    assert.equal(result.cart.filter((l) => l.sheetId === 'b').length, 2)
    assert.equal(result.cart.filter((l) => l.sheetId === 'a').length, 2)
  })

  it('moves lines onto the target sheet', () => {
    const cart = [line({ id: '1' }), line({ id: 'x', sheetId: 'other' })]
    const result = applyRecolorCart({
      cart,
      sourceSheetId: 'a',
      target: boardB,
      mode: 'move',
      maxRows: 8,
      allowedTypeIds: allowed
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.cart.length, 2)
    assert.equal(result.cart.find((l) => l.id === '1')?.sheetId, 'b')
    assert.equal(result.cart.find((l) => l.id === 'x')?.sheetId, 'other')
  })

  it('blocks copy when max rows would be exceeded', () => {
    const cart = [line({ id: '1' }), line({ id: '2' })]
    const result = applyRecolorCart({
      cart,
      sourceSheetId: 'a',
      target: boardB,
      mode: 'copy',
      maxRows: 3,
      allowedTypeIds: allowed
    })
    assert.equal(result.ok, false)
  })

  it('drops edges that are not allowed on target mapping', () => {
    const cart = [
      line({ id: '1', edgeIds: { top: 'abs-1', bottom: 'foil-04' } })
    ]
    const result = applyRecolorCart({
      cart,
      sourceSheetId: 'a',
      target: boardB,
      mode: 'move',
      maxRows: 8,
      allowedTypeIds: () => ['abs-1']
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.edgesDropped, true)
    assert.deepEqual(result.cart[0]?.edgeIds, { top: 'abs-1' })
  })
})
