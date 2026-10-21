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
  ean13OriginX,
  ean13TotalWidthDots,
  escapeZplFd,
  generateLabelZpl,
  mmToDots,
  packLabel33x25,
  ZPL_CONTENT_W,
  ZPL_DEFAULT_DARKNESS,
  ZPL_LABEL_H_DOTS,
  ZPL_LABEL_W_DOTS,
  ZPL_MODULE_DOTS,
  ZPL_PAD_DOTS
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

describe('ean13 geometry', () => {
  it('total width includes quiet zones (113 modules)', () => {
    assert.equal(ean13TotalWidthDots(), 113 * ZPL_MODULE_DOTS)
    assert.ok(ean13TotalWidthDots() <= ZPL_LABEL_W_DOTS - 2 * ZPL_PAD_DOTS)
  })

  it('origin keeps barcode inside side pad', () => {
    const bx = ean13OriginX()
    assert.ok(bx >= ZPL_PAD_DOTS)
    assert.ok(bx + ean13TotalWidthDots() <= ZPL_LABEL_W_DOTS - ZPL_PAD_DOTS + 1)
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
  it('emits centered FB text, LH, modest darkness, EAN quiet FO', () => {
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
    assert.match(zpl, /\^LH0,0/)
    assert.match(zpl, new RegExp(`\\^PW${ZPL_LABEL_W_DOTS}`))
    assert.match(zpl, new RegExp(`\\^LL${ZPL_LABEL_H_DOTS}`))
    assert.match(zpl, new RegExp(`\\^MD${ZPL_DEFAULT_DARKNESS}`))
    // Bottom-up: ^FB line count = actual wrapped lines (not maxLines)
    assert.match(zpl, new RegExp(`\\^FB${ZPL_CONTENT_W},[12],0,C,0`))
    assert.match(zpl, /\^BEN,/)
    assert.match(zpl, new RegExp(`\\^BY${ZPL_MODULE_DOTS},`))
    assert.match(zpl, new RegExp(`\\^FO${ean13OriginX()},`))
    assert.match(zpl, new RegExp(`\\^FD${ean.slice(0, 12)}\\^FS`))
    assert.equal(symbology, 'EAN13')
    assert.match(zpl, /Strong csavar/)
    assert.match(zpl, /11162/)
    assert.match(zpl, /4 Ft\/db/)
    assert.doesNotMatch(zpl, /…/)
  })

  it('does not JS-ellipsis long names', () => {
    const ean = buildInternalEan13('333333333')
    const long =
      'Strong csavar 4x20 3600.-/doboz extra hosszú termék megnevezés'
    const { zpl } = generateLabelZpl({
      productName: long,
      price: 4,
      unitShortform: 'db',
      fields: fieldsAll,
      payload: { sku: '11162', barcode: null, barcodeInternal: ean },
      barcodeValue: ean
    })
    assert.doesNotMatch(zpl, /…/)
    assert.match(zpl, /Strong csavar/)
  })

  it('never silently drops price when name wraps (photo bug)', () => {
    const ean = buildInternalEan13('444444444')
    const { zpl, packOk, droppedFields } = generateLabelZpl({
      productName: 'Strong csavar 4x20 3600.- /doboz',
      price: 4,
      unitShortform: 'db',
      fields: fieldsAll,
      payload: { sku: '11162', barcode: null, barcodeInternal: ean },
      barcodeValue: ean
    })
    assert.equal(packOk, true)
    assert.deepEqual(droppedFields, [])
    assert.match(zpl, /4 Ft\/db/)
    assert.match(zpl, /11162/)
    assert.match(zpl, /\^BEN,/)
  })

  it('pack grows fonts and keeps all fields', () => {
    const plan = packLabel33x25({
      productName: 'Strong csavar 4x20',
      price: 4,
      unitShortform: 'db',
      sku: '11162',
      showName: true,
      showSku: true,
      showPrice: true,
      showBarcode: true
    })
    assert.equal(plan.packOk, true)
    assert.equal(plan.blocks.length, 3)
    const price = plan.blocks.find((b) => b.kind === 'price')
    assert.ok(price)
    assert.ok(price!.font >= 24)
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
      fields: {
        ...fieldsAll,
        showName: false,
        showSku: false,
        showPrice: false
      },
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
