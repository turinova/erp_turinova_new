import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/**
 * Run: npx tsx --test src/lib/opti/szogvagas.test.ts
 */
import {
  szogPolygonPoints,
  szogPolygonSideCount,
  validateSzogCuts
} from './szogvagas'

describe('szogvagas', () => {
  it('1 corner → 5 sides', () => {
    assert.equal(szogPolygonSideCount(1), 5)
  })

  it('rejects empty corners', () => {
    const r = validateSzogCuts(1000, 1000, [])
    assert.equal(r.ok, false)
  })

  it('accepts one valid TR corner', () => {
    const r = validateSzogCuts(1000, 1000, [
      { corner: 'tr', remainEdge1Mm: 700, remainEdge2Mm: 600 }
    ])
    assert.equal(r.ok, true)
  })

  it('rejects remain >= full edge', () => {
    const r = validateSzogCuts(1000, 1000, [
      { corner: 'tr', remainEdge1Mm: 1000, remainEdge2Mm: 600 }
    ])
    assert.equal(r.ok, false)
  })

  it('rejects overlapping top corners', () => {
    const r = validateSzogCuts(1000, 1000, [
      { corner: 'tl', remainEdge1Mm: 600, remainEdge2Mm: 400 },
      { corner: 'tr', remainEdge1Mm: 600, remainEdge2Mm: 400 }
    ])
    assert.equal(r.ok, false)
  })

  it('polygon has 5 points for one corner', () => {
    const pts = szogPolygonPoints(1000, 1000, [
      { corner: 'tr', remainEdge1Mm: 700, remainEdge2Mm: 600 }
    ])
    assert.equal(pts.length, 5)
  })
})
