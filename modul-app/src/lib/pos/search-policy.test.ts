/**
 * POS search-policy — név / SKU / barcode / tábla stub variánsok.
 * Run: npm run test:pos-search-policy
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  isBarcodeExactPreviewOnly,
  isSheetDigitStub,
  mergeExactAndFuzzyHits,
  searchMinLength,
  shouldExactSuppressFuzzy,
  shouldRunBarcodeEnter,
  shouldShowTypingMissEmpty,
  wantProductInSaleSearch,
  wantSheetInSaleSearch
} from './search-policy'
import {
  barcodeLookupCandidates,
  isSkuTypeaheadQuery,
  looksLikeBarcode
} from './barcode'

describe('wantProductInSaleSearch (Mind + lapszab)', () => {
  it('Mind + 1277 (≥4 digit SKU) → termék keresés ON', () => {
    assert.equal(
      wantProductInSaleSearch({
        kind: 'all',
        q: '1277',
        includeMaterials: true
      }),
      true
    )
  })

  it('Mind + 127781 teljes SKU → termék ON', () => {
    assert.equal(
      wantProductInSaleSearch({
        kind: 'all',
        q: '127781',
        includeMaterials: true
      }),
      true
    )
  })

  it('Mind + 312 (3 digit stub) → termék OFF (tábla-only)', () => {
    assert.equal(
      wantProductInSaleSearch({
        kind: 'all',
        q: '312',
        includeMaterials: true
      }),
      false
    )
  })

  it('Mind + 312ABC (≥4) → termék ON + anyag', () => {
    assert.equal(
      wantProductInSaleSearch({
        kind: 'all',
        q: '312ABC',
        includeMaterials: true
      }),
      true
    )
  })

  it('Termék chip + bármilyen digit → termék ON', () => {
    assert.equal(
      wantProductInSaleSearch({
        kind: 'product',
        q: '312',
        includeMaterials: false
      }),
      true
    )
  })

  it('Tábla chip → wantProduct false', () => {
    assert.equal(
      wantProductInSaleSearch({
        kind: 'sheet_material',
        q: '1277',
        includeMaterials: true
      }),
      false
    )
  })

  it('Mind név → termék ON', () => {
    assert.equal(
      wantProductInSaleSearch({
        kind: 'all',
        q: 'pánt',
        includeMaterials: true
      }),
      true
    )
  })
})

describe('wantSheetInSaleSearch', () => {
  it('Mind + materials → sheet ON', () => {
    assert.equal(
      wantSheetInSaleSearch({
        kind: 'all',
        q: '312',
        includeMaterials: true
      }),
      true
    )
  })

  it('Termék chip → sheet OFF', () => {
    assert.equal(
      wantSheetInSaleSearch({
        kind: 'product',
        q: '312',
        includeMaterials: true
      }),
      false
    )
  })
})

describe('shouldRunBarcodeEnter', () => {
  const base = { hasLapszabaszat: true, searchKind: 'all' as const }

  it('SKU 127781 Enter → exact lookup', () => {
    assert.equal(shouldRunBarcodeEnter({ ...base, q: '127781' }), true)
  })

  it('SKU 1277 (4 digit, looksLikeBarcode false) Enter → still exact', () => {
    assert.equal(isSkuTypeaheadQuery('1277'), true)
    assert.equal(looksLikeBarcode('1277'), false)
    assert.equal(shouldRunBarcodeEnter({ ...base, q: '1277' }), true)
  })

  it('CODE128 DT-CZ00127781 Enter → exact', () => {
    assert.equal(
      shouldRunBarcodeEnter({ ...base, q: 'DT-CZ00127781' }),
      true
    )
  })

  it('EAN-13 Enter → exact', () => {
    assert.equal(
      shouldRunBarcodeEnter({ ...base, q: '5991234567890' }),
      true
    )
  })

  it('3 digit sheet stub 312 Enter → NEM barcode (lista pick)', () => {
    assert.equal(isSheetDigitStub('312'), true)
    assert.equal(shouldRunBarcodeEnter({ ...base, q: '312' }), false)
  })

  it('név pánt Enter → NEM barcode', () => {
    assert.equal(shouldRunBarcodeEnter({ ...base, q: 'pánt' }), false)
  })

  it('Termék chip + 312 → barcode/SKU path ha looksLike (nem stub block)', () => {
    // 312 is stub length but product chip → shouldRun: looksLikeBarcode(312)=false, isSku=false
    assert.equal(
      shouldRunBarcodeEnter({
        q: '312',
        hasLapszabaszat: true,
        searchKind: 'product'
      }),
      false
    )
  })

  it('lapszab ki + 312 → nem stub block; 312 nem barcode', () => {
    assert.equal(
      shouldRunBarcodeEnter({
        q: '312',
        hasLapszabaszat: false,
        searchKind: 'all'
      }),
      false
    )
  })
})

describe('exact suppress (Odoo len>5)', () => {
  it('rövid SKU 1277 + exact → ne suppress (fuzzy is jöhet)', () => {
    assert.equal(shouldExactSuppressFuzzy('1277', true), false)
  })

  it('127781 + exact → suppress', () => {
    assert.equal(shouldExactSuppressFuzzy('127781', true), true)
  })

  it('DT-CZ00127781 + exact → suppress', () => {
    assert.equal(shouldExactSuppressFuzzy('DT-CZ00127781', true), true)
  })

  it('nincs exact → ne suppress', () => {
    assert.equal(shouldExactSuppressFuzzy('127781', false), false)
  })
})

describe('mergeExactAndFuzzyHits', () => {
  const a = { id: 'a', name: 'A' }
  const b = { id: 'b', name: 'B' }
  const c = { id: 'c', name: 'C' }

  it('rövid SKU: exact elöl + fuzzy rest', () => {
    const merged = mergeExactAndFuzzyHits('1277', [b, a, c], a)
    assert.deepEqual(
      merged.map((x) => x.id),
      ['a', 'b', 'c']
    )
  })

  it('hosszú exact: csak exact', () => {
    const merged = mergeExactAndFuzzyHits('127781', [b, a, c], a)
    assert.deepEqual(
      merged.map((x) => x.id),
      ['a']
    )
  })

  it('nincs exact: fuzzy untouched', () => {
    const merged = mergeExactAndFuzzyHits('pánt', [b, c], null)
    assert.deepEqual(
      merged.map((x) => x.id),
      ['b', 'c']
    )
  })
})

describe('barcode exact preview vs SKU typeahead', () => {
  it('DT-CZ… → exact preview only', () => {
    assert.equal(isBarcodeExactPreviewOnly('DT-CZ00127781', false), true)
  })

  it('127781 SKU → NEM exact-only (typeahead+exact)', () => {
    assert.equal(isBarcodeExactPreviewOnly('127781', false), false)
    assert.equal(isSkuTypeaheadQuery('127781'), true)
  })

  it('sheetCode aktív → nem exact-only gate', () => {
    assert.equal(isBarcodeExactPreviewOnly('DT-CZ00127781', true), false)
  })

  it('részleges CODE128 miss gépeléskor → ne typing miss UI', () => {
    assert.equal(
      shouldShowTypingMissEmpty({
        q: 'DT-CZ00',
        exactMiss: true,
        sheetCodeActive: false
      }),
      false
    )
  })
})

describe('searchMinLength', () => {
  it('név → 2', () => {
    assert.equal(searchMinLength({ q: 'pá', sheetCodeActive: false }), 2)
  })

  it('digit → 4', () => {
    assert.equal(searchMinLength({ q: '12', sheetCodeActive: false }), 4)
  })

  it('sheet stub → 3', () => {
    assert.equal(searchMinLength({ q: '312', sheetCodeActive: true }), 3)
  })
})

describe('barcodeLookupCandidates (HU wedge / hyphen)', () => {
  it('hyphen-compact kandidátus', () => {
    const c = barcodeLookupCandidates('DT-CZ00127781')
    assert.ok(c.some((x) => x.replace(/-/g, '') === 'DTCZ00127781' || x === 'DTCZ00127781'))
    assert.ok(c.includes('DT-CZ00127781') || c.some((x) => x.includes('CZ00127781')))
  })

  it('Y↔Z swap kandidátus', () => {
    const c = barcodeLookupCandidates('DT-CY00127781')
    const upper = c.map((x) => x.toUpperCase())
    assert.ok(
      upper.some((x) => x.includes('CZ') || x.includes('CY')),
      `expected Y/Z variant in ${upper.join(',')}`
    )
  })

  it('EAN digits unchanged shape', () => {
    const c = barcodeLookupCandidates('5991234567890')
    assert.ok(c.includes('5991234567890'))
  })

  it('UPC-A 12 digit → EAN-13 leading-0 pad (valid check)', () => {
    // DB: 0502167061448 — scanner often sends 502167061448
    const c = barcodeLookupCandidates('502167061448')
    assert.ok(
      c.includes('0502167061448'),
      `expected padded EAN in ${c.join(',')}`
    )
    assert.ok(c.includes('502167061448'))
  })

  it('12 digit without valid EAN pad is not forced', () => {
    const c = barcodeLookupCandidates('111111111111')
    assert.ok(c.includes('111111111111'))
    assert.equal(
      c.includes('0111111111111'),
      false,
      'invalid EAN-13 pad must not be a candidate'
    )
  })
})

describe('looksLikeBarcode / isSkuTypeaheadQuery matrix', () => {
  const cases: Array<{
    q: string
    sku: boolean
    barcode: boolean
  }> = [
    { q: '1277', sku: true, barcode: false },
    { q: '127781', sku: true, barcode: true },
    { q: '12', sku: false, barcode: false },
    { q: '312', sku: false, barcode: false },
    { q: '5991234567890', sku: false, barcode: true },
    { q: 'DT-CZ00127781', sku: false, barcode: true },
    { q: 'pánt', sku: false, barcode: false },
    { q: 'asztal', sku: false, barcode: false }
  ]

  for (const c of cases) {
    it(`"${c.q}" sku=${c.sku} barcode=${c.barcode}`, () => {
      assert.equal(isSkuTypeaheadQuery(c.q), c.sku)
      assert.equal(looksLikeBarcode(c.q), c.barcode)
    })
  }
})
