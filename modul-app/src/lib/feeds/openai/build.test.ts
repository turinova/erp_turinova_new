import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildFeed,
  buildTitle,
  detectDecorCode,
  detectMaterial,
  grossPrice,
  skipReason,
  toJsonl,
  type FeedConfig,
  type FeedSourceRow
} from './build'

const cfg: FeedConfig = {
  siteBaseUrl: 'https://www.hirosablak.hu/',
  sheetPath: '/butorlap',
  linearPath: 'munkalap',
  country: 'HU',
  currency: 'HUF',
  sellerName: 'Hírös Ablak',
  pickupText: 'Kecskemét, H–P 7–16',
  returnPolicyUrl: '',
  returnDays: 14
}

function sheet(over: Partial<FeedSourceRow> = {}): FeedSourceRow {
  return {
    kind: 'sheet',
    id: 'a1',
    name: 'U702 ST9 Kasmír szürke',
    brand: 'Egger',
    slug: 'egger-u702-st9-18',
    indexable: true,
    excluded: false,
    imageUrl: 'https://x.supabase.co/img.jpg',
    lengthMm: 2800,
    widthMm: 2070,
    thicknessMm: 18,
    priceNet: 5000,
    vatPercent: 27,
    onStock: true,
    ...over
  }
}

test('sheet price = Ft/m² × area × VAT', () => {
  assert.equal(grossPrice(sheet()), Math.round(5000 * 2.8 * 2.07 * 1.27))
})

test('linear price = Ft/m × length × VAT', () => {
  const row = sheet({ kind: 'linear', lengthMm: 4100, widthMm: 600, thicknessMm: 38, priceNet: 10000 })
  assert.equal(grossPrice(row), Math.round(10000 * 4.1 * 1.27))
})

test('skip reasons', () => {
  assert.equal(skipReason(sheet()), null)
  assert.equal(skipReason(sheet({ excluded: true })), 'excluded')
  assert.equal(skipReason(sheet({ indexable: false })), 'not_indexable')
  assert.equal(skipReason(sheet({ slug: null })), 'no_slug')
  assert.equal(skipReason(sheet({ imageUrl: 'http://x/img.jpg' })), 'no_image')
  assert.equal(skipReason(sheet({ priceNet: 0 })), 'no_price')
  assert.equal(skipReason(sheet({ brand: ' ' })), 'no_brand')
})

test('material detection, unknown → null', () => {
  assert.equal(detectMaterial('Fehér MDF 18', null), 'MDF')
  assert.equal(detectMaterial('Szálfa', 'Kronospan OSB'), 'OSB')
  assert.equal(detectMaterial('Nyír rétegelt lemez', null), 'Rétegelt lemez')
  assert.equal(detectMaterial('Hátfal fehér HDF', null), 'HDF')
  assert.equal(detectMaterial('U702 ST9 Kasmír', 'Egger'), null)
})

test('decor code', () => {
  assert.equal(detectDecorCode('U702 ST9 Kasmír'), 'U702')
  assert.equal(detectDecorCode('H1145 ST10 Bardolino'), 'H1145')
  assert.equal(detectDecorCode('Fehér'), null)
})

test('title has brand, kind and size once', () => {
  assert.equal(buildTitle(sheet()), 'Egger U702 ST9 Kasmír szürke bútorlap – 18 mm, 2800×2070 mm')
  assert.equal(
    buildTitle(sheet({ name: 'Egger fehér bútorlap' })),
    'Egger fehér bútorlap – 18 mm, 2800×2070 mm'
  )
})

test('feed groups variants and omits unknown fields', () => {
  const rows = [sheet(), sheet({ id: 'a2', thicknessMm: 10, slug: 'egger-u702-10' }), sheet({ id: 'b', name: 'Fehér', slug: 'feher' })]
  const { items, skipped } = buildFeed(rows, cfg)
  assert.equal(skipped.length, 0)
  assert.equal(items[0].url, 'https://www.hirosablak.hu/butorlap/egger-u702-st9-18')
  assert.equal(items[0].group_id, items[1].group_id)
  assert.equal(items[0].listing_has_variations, true)
  assert.equal(items[2].listing_has_variations, false)
  assert.equal(items[2].variant_dict, undefined)
  assert.equal('material' in items[0], false)
  assert.equal(items[0].return_deadline_in_days, 14)
  assert.match(items[0].price, /^\d+ HUF$/)
  assert.equal(toJsonl(items).trim().split('\n').length, 3)
})
