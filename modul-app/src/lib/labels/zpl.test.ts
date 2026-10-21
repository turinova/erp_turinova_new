/**
 * 33×25 ZPL generator tests.
 * Run: npm run test:label-zpl
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildInternalEan13 } from '@/lib/barcodes/ean13'
import {
  code128Fits33mm,
  ean13Data12ForZpl,
  escapeZplFd,
  generateLabelZpl,
  mmToDots,
  ZPL_LABEL_H_DOTS,
  ZPL_LABEL_W_DOTS,
  ZPL_MODULE_DOTS
} from './zpl'

const fieldsAll = {
  showName: true,
  showSku: true,
  showBarcode: true,
  showPrice: true
}

describe('escapeZplFd', () => {
  it('strips caret and tilde', () => {
    assert.equal(escapeZplFd('a^b~c'), 'abc')
  })
})

describe('ean13Data12ForZpl', () => {
  it('returns 12 digits for valid EAN-13', () => {
    const ean = buildInternalEan13('123456789')
    assert.equal(ean.length, 13)
    const d12 = ean13Data12ForZpl(ean)
    assert.equal(d12, ean.slice(0, 12))
  })

  it('rejects invalid check digit', () => {
    assert.equal(ean13Data12ForZpl('2001234567890'), null)
  })
})

describe('code128Fits33mm', () => {
  it('short digits fit', () => {
    assert.equal(code128Fits33mm('123456'), true)
  })

  it('very long alphanumeric may not fit', () => {
    assert.equal(
      code128Fits33mm('DT-CZ-VERY-LONG-SUPPLIER-CODE-123456789'),
      false
    )
  })
})

describe('generateLabelZpl', () => {
  it('emits media size and UTF-8', () => {
    const ean = buildInternalEan13('123456789')
    const { zpl, symbology } = generateLabelZpl({
      productName: 'Strong csavar 4x20',
      price: 4,
      unitShortform: 'db',
      fields: fieldsAll,
      payload: { sku: '11162', barcode: null, barcodeInternal: ean },
      barcodeValue: ean,
      amount: 1
    })
    assert.match(zpl, /\^XA/)
    assert.match(zpl, /\^XZ/)
    assert.match(zpl, /\^CI28/)
    assert.match(zpl, new RegExp(`\\^PW${ZPL_LABEL_W_DOTS}`))
    assert.match(zpl, new RegExp(`\\^LL${ZPL_LABEL_H_DOTS}`))
    assert.match(zpl, /\^BEN,/)
    assert.match(zpl, new RegExp(`\\^BY${ZPL_MODULE_DOTS},`))
    assert.match(zpl, new RegExp(`\\^FD${ean.slice(0, 12)}\\^FS`))
    assert.equal(symbology, 'EAN13')
    assert.match(zpl, /Strong csavar/)
    assert.match(zpl, /11162/)
    assert.match(zpl, /4 Ft\/db/)
  })

  it('uses ^PQ for copies', () => {
    const ean = buildInternalEan13('111111111')
    const { zpl } = generateLabelZpl({
      productName: 'Teszt',
      price: 1,
      unitShortform: 'db',
      fields: fieldsAll,
      payload: { sku: '1', barcode: null, barcodeInternal: ean },
      barcodeValue: ean,
      amount: 5
    })
    assert.match(zpl, /\^PQ5,0,1,Y/)
  })

  it('maps offset mm to ^LS/^LT dots', () => {
    const ean = buildInternalEan13('222222222')
    const { zpl } = generateLabelZpl({
      productName: 'X',
      price: 1,
      unitShortform: 'db',
      fields: { ...fieldsAll, showName: false, showSku: false, showPrice: false },
      payload: { sku: '', barcode: null, barcodeInternal: ean },
      barcodeValue: ean,
      offsetXMm: 1,
      offsetYMm: -0.5
    })
    assert.match(zpl, new RegExp(`\\^LS${mmToDots(1)}`))
    assert.match(zpl, new RegExp(`\\^LT${mmToDots(-0.5)}`))
  })

  it('CODE128 for non-EAN supplier code', () => {
    const { zpl, symbology, barcodeFits, fitWarning } = generateLabelZpl({
      productName: 'X',
      price: 1,
      unitShortform: 'db',
      fields: fieldsAll,
      payload: {
        sku: '1',
        barcode: 'ABC123',
        barcodeInternal: null
      },
      barcodeValue: 'ABC123'
    })
    assert.equal(symbology, 'CODE128')
    assert.match(zpl, /\^BCN,/)
    assert.equal(barcodeFits, true)
    assert.equal(fitWarning, null)
  })

  it('warns when long CODE128 does not fit', () => {
    const long = 'DT-CZ-VERY-LONG-SUPPLIER-CODE-123456789'
    const { barcodeFits, fitWarning, symbology } = generateLabelZpl({
      productName: 'X',
      price: 1,
      unitShortform: 'db',
      fields: fieldsAll,
      payload: { sku: '1', barcode: long, barcodeInternal: null },
      barcodeValue: long
    })
    assert.equal(symbology, 'CODE128')
    assert.equal(barcodeFits, false)
    assert.ok(fitWarning)
  })
})
