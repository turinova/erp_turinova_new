/**
 * Run: npm run test:kiosk-leftover
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  fullBoardReason,
  staffLeftoverLabel
} from './leftover'

describe('fullBoardReason', () => {
  it('always_full_board → always', () => {
    assert.equal(fullBoardReason('always_full_board', true), 'always')
    assert.equal(fullBoardReason('always_full_board', false), 'always')
  })

  it('standard + rendelésre → always', () => {
    assert.equal(fullBoardReason('standard', false), 'always')
  })

  it('standard + raktáron → usage', () => {
    assert.equal(fullBoardReason('standard', true), 'usage')
  })

  it('always_panel_area → usage (soha nem full board ok)', () => {
    assert.equal(fullBoardReason('always_panel_area', false), 'usage')
  })
})

describe('staffLeftoverLabel', () => {
  it('full_board → jelvény', () => {
    assert.equal(staffLeftoverLabel('full_board', 2), 'Maradék a megrendelőé')
  })

  it('mixed → számlált szöveg', () => {
    assert.equal(
      staffLeftoverLabel('mixed', 1),
      '1 teljes tábla maradéka a megrendelőé'
    )
  })

  it('panel_area vagy 0 → null', () => {
    assert.equal(staffLeftoverLabel('panel_area', 0), null)
    assert.equal(staffLeftoverLabel('full_board', 0), null)
    assert.equal(staffLeftoverLabel('mixed', 0), null)
  })
})
