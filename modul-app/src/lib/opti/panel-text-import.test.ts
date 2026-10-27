/**
 * Run: npx tsx --test src/lib/opti/panel-text-import.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  parsePanelTextImport,
  parsePanelTextLine
} from './panel-text-import'

describe('parsePanelTextLine', () => {
  it('parses space-separated dims + qty', () => {
    const r = parsePanelTextLine('720 560 2', 1)
    assert.equal(r.grainMm, 720)
    assert.equal(r.crossMm, 560)
    assert.equal(r.quantity, 2)
  })

  it('parses 800x400 x4', () => {
    const r = parsePanelTextLine('800x400 x4', 1)
    assert.equal(r.grainMm, 800)
    assert.equal(r.crossMm, 400)
    assert.equal(r.quantity, 4)
  })

  it('parses semicolon dims', () => {
    const r = parsePanelTextLine('600;400;1', 1)
    assert.equal(r.grainMm, 600)
    assert.equal(r.crossMm, 400)
    assert.equal(r.quantity, 1)
  })

  it('ignores edge part after pipe', () => {
    const r = parsePanelTextLine('720 560 2 A1 | 2-2 ABS22', 1)
    assert.equal(r.grainMm, 720)
    assert.equal(r.crossMm, 560)
    assert.equal(r.quantity, 2)
    assert.equal(r.issues.length, 0)
  })

  it('ignores marking tokens', () => {
    const r = parsePanelTextLine('720 560 2 A1', 1)
    assert.equal(r.grainMm, 720)
    assert.equal(r.crossMm, 560)
    assert.equal(r.quantity, 2)
  })

  it('default qty=1 when only two numbers', () => {
    const r = parsePanelTextLine('720 560', 1)
    assert.equal(r.quantity, 1)
  })

  it('missing cross → issue', () => {
    const r = parsePanelTextLine('720', 1)
    assert.equal(r.grainMm, 720)
    assert.equal(r.crossMm, null)
    assert.ok(r.issues.some((i) => i.includes('szál')))
  })
})

describe('parsePanelTextImport', () => {
  it('builds statuses with max mm', () => {
    const rows = parsePanelTextImport('720 560 1\n9000 560 1\n800x400 x2', {
      maxGrainMm: 2780,
      maxCrossMm: 2050
    })
    assert.equal(rows.length, 3)
    assert.equal(rows[0]?.status, 'ok')
    assert.equal(rows[1]?.status, 'error')
    assert.equal(rows[2]?.status, 'ok')
    assert.equal(rows[2]?.quantity, 2)
  })
})
