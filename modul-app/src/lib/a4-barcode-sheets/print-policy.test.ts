import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  a4FitsCode,
  resolveA4PrintableBarcode
} from '@/lib/a4-barcode-sheets/print-policy'
import { buildInternalEan13 } from '@/lib/barcodes/ean13'

test('long CODE128 fits wide A4 cell but not narrow', () => {
  const long = 'DT-CZ-ABCDEFGHIJKLMNOPQRST'
  assert.equal(a4FitsCode(long, 90), true)
  assert.equal(a4FitsCode(long, 20), false)
})

test('force internal EAN when supplier overflows requested cell', () => {
  const long = 'DT-CZ-ABCDEFGHIJKLMNOPQRST'
  const internal = buildInternalEan13('123456789')
  const r = resolveA4PrintableBarcode(
    { barcode: long, barcodeInternal: internal },
    40,
    'supplier'
  )
  assert.equal(r.blocked, false)
  assert.equal(r.value, internal)
  assert.equal(r.forcedInternal, true)
  assert.equal(r.source, 'internal')
})

test('empty codes are blocked', () => {
  const r = resolveA4PrintableBarcode(
    { barcode: null, barcodeInternal: null },
    60,
    'auto'
  )
  assert.equal(r.blocked, true)
  assert.equal(r.value, null)
})
