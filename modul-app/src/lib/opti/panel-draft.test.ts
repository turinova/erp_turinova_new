/**
 * Run: npx tsx --test src/lib/opti/panel-draft.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  createPanelDraft,
  normalizePanthelyOldal,
  panthelyEdgeIsHorizontal,
  panthelyEdgeMm,
  panthelyLabel,
  panthelyPositionsMm,
  panthelySideText
} from './panel-draft'

const base = {
  sheetMaterialId: 'm1',
  sheetMaterialName: 'Anyag',
  grainMm: 300,
  crossMm: 800,
  quantity: 1,
  marking: '',
  edgeAId: '',
  edgeBId: '',
  edgeCId: '',
  edgeDId: '',
  edgeALabel: '',
  edgeBLabel: '',
  edgeCLabel: '',
  edgeDLabel: ''
}

describe('panthelyEdgeMm', () => {
  it('uses the geometric longer / shorter side, not grain', () => {
    assert.equal(panthelyEdgeMm(300, 800, 'hosszu'), 800)
    assert.equal(panthelyEdgeMm(300, 800, 'rovid'), 300)
    assert.equal(panthelyEdgeMm(720, 400, 'hosszu'), 720)
  })
})

describe('panthelyLabel', () => {
  it('formats side and mm', () => {
    assert.equal(
      panthelyLabel({
        quantity: 3,
        oldal: 'hosszu',
        grainMm: 300,
        crossMm: 800,
        withMm: true
      }),
      'Pánthely 3 · hosszú (800 mm)'
    )
    assert.equal(
      panthelyLabel({ quantity: 2, oldal: 'rovid' }),
      'Pánthely 2 · rövid'
    )
  })

  it('square panel names the grain / cross edge', () => {
    assert.equal(
      panthelyLabel({
        quantity: 2,
        oldal: 'hosszu',
        grainMm: 600,
        crossMm: 600,
        withMm: true
      }),
      'Pánthely 2 · szálirányú (600 mm)'
    )
    assert.equal(panthelySideText('rovid', 600, 600), 'keresztirányú él')
    assert.equal(panthelySideText('rovid', 720, 400), 'rövid oldal')
  })

  it('legacy row without side stays plain', () => {
    assert.equal(panthelyLabel({ quantity: 4, oldal: null }), 'Pánthely 4')
  })
})

describe('panthelyEdgeIsHorizontal', () => {
  it('horizontal = grain edge; square splits by grain', () => {
    assert.equal(panthelyEdgeIsHorizontal(720, 400, 'hosszu'), true)
    assert.equal(panthelyEdgeIsHorizontal(720, 400, 'rovid'), false)
    assert.equal(panthelyEdgeIsHorizontal(300, 800, 'rovid'), true)
    assert.equal(panthelyEdgeIsHorizontal(600, 600, 'hosszu'), true)
    assert.equal(panthelyEdgeIsHorizontal(600, 600, 'rovid'), false)
  })
})

describe('panthelyPositionsMm', () => {
  it('100 mm from both ends, middles evenly spaced', () => {
    assert.deepEqual(panthelyPositionsMm(720, 2), [100, 620])
    assert.deepEqual(panthelyPositionsMm(720, 3), [100, 360, 620])
  })
})

describe('createPanelDraft panthely oldal', () => {
  it('defaults to hosszu when holes exist', () => {
    const p = createPanelDraft({ ...base, panthelyfurasQuantity: 2 })
    assert.equal(p.panthelyfurasOldal, 'hosszu')
  })

  it('keeps rovid', () => {
    const p = createPanelDraft({
      ...base,
      panthelyfurasQuantity: 3,
      panthelyfurasOldal: 'rovid'
    })
    assert.equal(p.panthelyfurasOldal, 'rovid')
  })

  it('null without holes', () => {
    const p = createPanelDraft({
      ...base,
      panthelyfurasQuantity: 0,
      panthelyfurasOldal: 'rovid'
    })
    assert.equal(p.panthelyfurasOldal, null)
  })

  it('normalizes unknown DB values', () => {
    assert.equal(normalizePanthelyOldal('x'), null)
    assert.equal(normalizePanthelyOldal(null), null)
  })
})
