/**
 * 33×25 barcode print policy.
 * Run: npm run test:label-print-policy
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildInternalEan13 } from '@/lib/barcodes/ean13'
import {
  classifyBarcodeFor33x25,
  defaultBarcodeSource,
  isScannableOn33x25,
  resolvePrintableBarcode
} from './print-policy'

describe('classifyBarcodeFor33x25', () => {
  it('classifies valid EAN', () => {
    const ean = buildInternalEan13('123456789')
    assert.equal(classifyBarcodeFor33x25(ean).kind, 'ean13')
  })

  it('flags DT-CZ overflow', () => {
    assert.equal(
      classifyBarcodeFor33x25('DT-CZ00011103').kind,
      'code128_overflow'
    )
    assert.equal(isScannableOn33x25('DT-CZ00011103'), false)
  })

  it('allows short CODE128', () => {
    assert.equal(classifyBarcodeFor33x25('ABC123').kind, 'code128_ok')
  })
})

describe('resolvePrintableBarcode', () => {
  const ean = buildInternalEan13('555555555')

  it('forces internal when supplier overflows', () => {
    const r = resolvePrintableBarcode(
      { barcode: 'DT-CZ00011103', barcodeInternal: ean },
      'supplier'
    )
    assert.equal(r.forcedInternal, true)
    assert.equal(r.blocked, false)
    assert.equal(r.value, ean)
    assert.equal(r.source, 'internal')
  })

  it('warns forcedInternal on auto when supplier overflows', () => {
    const r = resolvePrintableBarcode(
      { barcode: 'DT-CZ00011103', barcodeInternal: ean },
      'auto'
    )
    assert.equal(r.forcedInternal, true)
    assert.equal(r.value, ean)
    assert.equal(r.source, 'internal')
  })

  it('blocks when no internal and supplier overflows', () => {
    const r = resolvePrintableBarcode(
      { barcode: 'DT-CZ00011103', barcodeInternal: null },
      'auto'
    )
    assert.equal(r.blocked, true)
    assert.equal(r.value, null)
    assert.equal(r.action, 'create_internal')
    assert.ok(r.message?.includes('belső'))
  })

  it('uses EAN supplier when no internal', () => {
    const supplierEan = buildInternalEan13('111111111')
    const r = resolvePrintableBarcode(
      { barcode: supplierEan, barcodeInternal: null },
      'auto'
    )
    assert.equal(r.blocked, false)
    assert.equal(r.value, supplierEan)
  })

  it('defaultBarcodeSource prefers internal EAN', () => {
    assert.equal(
      defaultBarcodeSource({
        id: '1',
        name: 'x',
        sku: '1',
        barcode: 'DT-CZ00011103',
        barcodeInternal: ean,
        priceGross: 1,
        unitShortform: 'db'
      }),
      'internal'
    )
  })
})
