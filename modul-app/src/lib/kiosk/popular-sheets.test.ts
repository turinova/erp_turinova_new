/**
 * Run: npx tsx --test src/lib/kiosk/popular-sheets.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { pickFeaturedSheets } from './popular-sheets'

describe('pickFeaturedSheets', () => {
  const catalog = [
    { id: 'a', name: 'Alfa', onStock: true },
    { id: 'b', name: 'Béta', onStock: false },
    { id: 'c', name: 'Cé', onStock: true },
    { id: 'd', name: 'Delta', onStock: true }
  ]

  it('orders by popular ids that are in catalog', () => {
    const featured = pickFeaturedSheets(catalog, ['c', 'a', 'missing'], 8)
    assert.deepEqual(
      featured.map((s) => s.id),
      ['c', 'a', 'd', 'b']
    )
  })

  it('fills with stock-first fallback when no popular', () => {
    const featured = pickFeaturedSheets(catalog, [], 3)
    assert.deepEqual(
      featured.map((s) => s.id),
      ['a', 'c', 'd']
    )
  })

  it('respects take limit', () => {
    const featured = pickFeaturedSheets(catalog, ['d', 'c', 'a'], 2)
    assert.deepEqual(
      featured.map((s) => s.id),
      ['d', 'c']
    )
  })
})
