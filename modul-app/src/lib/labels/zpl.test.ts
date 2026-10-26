/**
 * 33×25 ZPL generator tests.
 * Run: npm run test:label-zpl
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildInternalEan13 } from '@/lib/barcodes/ean13'
import {
  allocateZoneDots,
  clampLabelName,
  code128Fits33mm,
  code128BarsCenterX,
  code128OriginX,
  ean13BarsCenterX,
  ean13Data12ForZpl,
  ean13OriginX,
  ean13TotalWidthDots,
  EAN13_BAR_MODULES,
  escapeZplFd,
  estimateFbLinesRaw,
  fbCharsPerLine,
  fitTextToFbLines,
  generateLabelZpl,
  LABEL_NAME_MAX_CHARS,
  mmToDots,
  packLabel33x25,
  truncateLabelNameInput,
  ZONE_WEIGHT,
  ZPL_BARCODE_BAND_MIN_DOTS,
  ZPL_CONTENT_H,
  ZPL_CONTENT_W,
  ZPL_DEFAULT_DARKNESS,
  ZPL_LABEL_CENTER_X,
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

  it('^FO is left of bars (not quiet) and bars stay on label', () => {
    const bx = ean13OriginX()
    const barW = EAN13_BAR_MODULES * ZPL_MODULE_DOTS
    assert.equal(bx, ZPL_LABEL_CENTER_X - Math.floor(barW / 2))
    assert.ok(bx >= 0)
    assert.ok(bx + barW <= ZPL_LABEL_W_DOTS)
  })

  it('visible bars share label center with ^FB text axis', () => {
    assert.equal(ean13BarsCenterX(), ZPL_LABEL_CENTER_X)
    // Content box (^FO pad + ^FB width) center == label center
    assert.equal(ZPL_PAD_DOTS + Math.floor(ZPL_CONTENT_W / 2), ZPL_LABEL_CENTER_X)
  })
})

describe('code128 geometry', () => {
  it('bars share label center with ^FB text axis', () => {
    const code = '10006634300'
    assert.equal(code128BarsCenterX(code), ZPL_LABEL_CENTER_X)
    const fo = code128OriginX(code)
    assert.ok(fo >= 0)
    assert.ok(fo < ZPL_LABEL_CENTER_X)
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

describe('allocateZoneDots', () => {
  it('sums to content height for full weights', () => {
    const h = allocateZoneDots({ ...ZONE_WEIGHT }, ZPL_CONTENT_H)
    assert.equal(h.name + h.sku + h.price + h.barcode, ZPL_CONTENT_H)
    assert.ok(h.barcode >= ZPL_BARCODE_BAND_MIN_DOTS - 5)
  })

  it('full grid always uses all four weights', () => {
    const h = allocateZoneDots({ ...ZONE_WEIGHT }, ZPL_CONTENT_H)
    assert.ok(h.name > 0 && h.sku > 0 && h.price > 0 && h.barcode > 0)
  })
})

describe('fixed zones (no redistribute)', () => {
  it('keeps price/barcode Y the same when SKU is off', () => {
    const full = packLabel33x25({
      productName: 'Strong csavar 4x20',
      price: 4,
      unitShortform: 'db',
      sku: '11162',
      showName: true,
      showSku: true,
      showPrice: true,
      showBarcode: true
    })
    const noSku = packLabel33x25({
      productName: 'Strong csavar 4x20',
      price: 4,
      unitShortform: 'db',
      sku: '11162',
      showName: true,
      showSku: false,
      showPrice: true,
      showBarcode: true
    })
    const priceFull = full.blocks.find((b) => b.kind === 'price')!
    const priceNoSku = noSku.blocks.find((b) => b.kind === 'price')!
    assert.equal(priceFull.zoneY, priceNoSku.zoneY)
    assert.equal(priceFull.zoneH, priceNoSku.zoneH)
    assert.equal(full.zones.barcode?.y, noSku.zones.barcode?.y)
    assert.equal(full.zones.barcode?.h, noSku.zones.barcode?.h)
    assert.equal(noSku.blocks.some((b) => b.kind === 'sku'), false)
    // SKU slot still reserved
    assert.ok(noSku.zones.sku && noSku.zones.sku.h > 0)
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

  it('clamps long names to LABEL_NAME_MAX_CHARS with ellipsis', () => {
    const ean = buildInternalEan13('333333333')
    const long =
      'Strong csavar 4x20 3600.-/doboz extra hosszú termék megnevezés ami biztosan túlcsordul'
    assert.ok(long.length > LABEL_NAME_MAX_CHARS)
    const clamped = clampLabelName(long)
    assert.equal(clamped.length, LABEL_NAME_MAX_CHARS)
    assert.ok(clamped.endsWith('…'))
    assert.equal(truncateLabelNameInput(long).length, LABEL_NAME_MAX_CHARS)
    const { zpl } = generateLabelZpl({
      productName: long,
      price: 4,
      unitShortform: 'db',
      fields: fieldsAll,
      payload: { sku: '11162', barcode: null, barcodeInternal: ean },
      barcodeValue: ean
    })
    assert.match(zpl, /…/)
    assert.match(zpl, /Strong csavar/)
    assert.doesNotMatch(zpl, /túlcsordul/)
  })

  it('name never needs more than 2 FB lines (slim overflow bug)', () => {
    const ean = buildInternalEan13('888888888')
    const long =
      'SLIM DUPLAFALÚ FIÓKOLDAL DF-A 300mm ANTRACIT EXTRA HOSSZÚ'
    const plan = packLabel33x25({
      productName: long,
      price: 7177,
      unitShortform: 'Grt',
      sku: '10006634300',
      showName: true,
      showSku: true,
      showPrice: true,
      showBarcode: true
    })
    const name = plan.blocks.find((b) => b.kind === 'name')!
    const sku = plan.blocks.find((b) => b.kind === 'sku')!
    assert.ok(name.lines <= 2)
    assert.ok(estimateFbLinesRaw(name.text, name.fontW) <= 2)
    assert.ok(name.y + name.lines * (name.fontH + 1) <= sku.zoneY + 1)
    const { zpl } = generateLabelZpl({
      productName: long,
      price: 7177,
      unitShortform: 'Grt',
      fields: fieldsAll,
      payload: { sku: '10006634300', barcode: null, barcodeInternal: ean },
      barcodeValue: ean
    })
    assert.match(zpl, /\^FB248,2,0,C,0/)
    assert.doesNotMatch(zpl, /EXTRA HOSSZÚ/)
  })

  it('fitTextToFbLines respects budget', () => {
    const fontW = 24
    const cpl = fbCharsPerLine(fontW)
    const raw = 'X'.repeat(cpl * 3)
    const fitted = fitTextToFbLines(raw, fontW, 2)
    assert.ok(fitted.length <= cpl * 2)
    assert.ok(fitted.endsWith('…'))
    assert.ok(estimateFbLinesRaw(fitted, fontW) <= 2)
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

  it('zone pack: SKU/price 1 line, name ≤2, square fonts (axis-safe)', () => {
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
    const name = plan.blocks.find((b) => b.kind === 'name')
    const sku = plan.blocks.find((b) => b.kind === 'sku')
    const price = plan.blocks.find((b) => b.kind === 'price')
    assert.ok(name && name.lines <= 2)
    assert.ok(sku && sku.lines === 1)
    assert.ok(price && price.lines === 1)
    assert.equal(price!.fontW, price!.fontH)
    assert.equal(name!.fontW, name!.fontH)
    assert.ok(plan.barH >= ZPL_BARCODE_BAND_MIN_DOTS - 2)
  })

  it('EAN and CODE128 FO place bars on label center axis', () => {
    const ean = buildInternalEan13('555555555')
    const { zpl: zplEan } = generateLabelZpl({
      productName: 'Axis test',
      price: 100,
      unitShortform: 'db',
      fields: fieldsAll,
      payload: { sku: 'SKU1', barcode: null, barcodeInternal: ean },
      barcodeValue: ean
    })
    assert.match(zplEan, new RegExp(`\\^FO${ean13OriginX()},`))
    assert.equal(ean13BarsCenterX(), ZPL_LABEL_CENTER_X)

    const supplier = '10006634300'
    const { zpl: zplC128, symbology } = generateLabelZpl({
      productName: 'Axis test',
      price: 100,
      unitShortform: 'db',
      fields: fieldsAll,
      payload: { sku: 'SKU1', barcode: supplier, barcodeInternal: null },
      barcodeValue: supplier
    })
    assert.equal(symbology, 'CODE128')
    assert.match(zplC128, new RegExp(`\\^FO${code128OriginX(supplier)},`))
    assert.equal(code128BarsCenterX(supplier), ZPL_LABEL_CENTER_X)
  })

  it('zone order: name above sku above price above barcode', () => {
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
    const name = plan.blocks.find((b) => b.kind === 'name')!
    const sku = plan.blocks.find((b) => b.kind === 'sku')!
    const price = plan.blocks.find((b) => b.kind === 'price')!
    assert.ok(name.zoneY < sku.zoneY)
    assert.ok(sku.zoneY < price.zoneY)
    assert.ok(price.zoneY < plan.barY)
    // No huge dead gap: price zone ends near barcode zone
    const priceZoneEnd = price.zoneY + price.zoneH
    assert.ok(plan.barY - priceZoneEnd <= 2)
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
