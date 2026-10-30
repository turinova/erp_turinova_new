import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  A4_BARCODE_ZONE_MAX_MM,
  A4_STACK_GAP_MM,
  A4_ZONE_WEIGHT,
  a4LayoutScale,
  allocateZoneMm,
  fitNameLines,
  formatA4PriceLine,
  nameMaxCharsForWidth,
  packA4Cell
} from '@/lib/a4-barcode-sheets/layout'

test('zone weights sum to 100', () => {
  const sum =
    A4_ZONE_WEIGHT.name +
    A4_ZONE_WEIGHT.sku +
    A4_ZONE_WEIGHT.price +
    A4_ZONE_WEIGHT.barcode
  assert.equal(sum, 100)
})

test('allocateZoneMm sums to total', () => {
  const h = allocateZoneMm({ ...A4_ZONE_WEIGHT }, 40)
  const sum = h.name + h.sku + h.price + h.barcode
  assert.ok(Math.abs(sum - 40) < 0.02)
})

test('4×6 — name capped, SKU gets room', () => {
  const p = packA4Cell(50, 48, {
    showName: true,
    showSku: true,
    showPrice: true,
    showBarcode: true
  })
  assert.ok(p.layoutScale < 1.2)
  assert.ok(p.zones.barcode.height <= A4_BARCODE_ZONE_MAX_MM + 0.5)
  assert.ok(p.zones.name.height <= 10)
  const gap =
    p.zones.sku.yFromTop - (p.zones.name.yFromTop + p.zones.name.height)
  assert.ok(gap < A4_STACK_GAP_MM + 0.2)
})

test('2×4 — scales up and fills cell', () => {
  const p = packA4Cell(100, 72, {
    showName: true,
    showSku: true,
    showPrice: true,
    showBarcode: true
  })
  assert.ok(p.layoutScale >= 1.45)
  assert.ok(p.zones.name.height > 10)
  assert.ok(p.zones.sku.height > 10)
  assert.ok(p.zones.price.height > 10)
  assert.ok(p.zones.barcode.height >= 14)
  const used =
    p.zones.name.height +
    p.zones.sku.height +
    p.zones.price.height +
    p.zones.barcode.height
  assert.ok(used > p.contentH * 0.82)
  assert.ok(a4LayoutScale(p.contentH) === p.layoutScale)
})

test('barcode-only fills content', () => {
  const p = packA4Cell(60, 40, {
    showName: false,
    showSku: false,
    showPrice: false,
    showBarcode: true
  })
  assert.equal(p.zones.barcode.height, p.contentH)
})

test('name max chars is always 44', () => {
  assert.equal(nameMaxCharsForWidth(30), 44)
  assert.equal(nameMaxCharsForWidth(80), 44)
})

test('fitNameLines keeps all characters on 2 lines', () => {
  const [a] = fitNameLines('Rövid', 20)
  assert.equal(a, 'Rövid')
  const full =
    'Riex NC40 135-os kivetopant, rapattinthato kivitel'
  const capped = full.slice(0, 44)
  const two = fitNameLines(capped, 18)
  assert.equal(two.length, 2)
  assert.equal(two.join('').replace(/\s/g, ''), capped.replace(/\s/g, ''))
})

test('formatA4PriceLine includes unit + thousand grouping', () => {
  assert.equal(formatA4PriceLine(405, 'db'), '405 Ft/db')
  assert.equal(formatA4PriceLine(1490, 'db'), '1 490 Ft/db')
  assert.equal(formatA4PriceLine(12490, 'm'), '12 490 Ft/m')
  assert.equal(formatA4PriceLine(null, 'db'), null)
})
