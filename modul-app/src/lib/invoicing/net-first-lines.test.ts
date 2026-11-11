/**
 * Run: npx tsx --test src/lib/invoicing/net-first-lines.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  exactNetForGross,
  isValidVatForNet,
  splitGross,
  vatFromNet
} from '../money/vat-split'
import {
  buildAdvanceLines,
  fitNetFirstLines,
  mapSaleItemsNetFirst,
  type GrossTargetLine,
  type NetFirstInvoiceLine
} from './net-first-lines'
import {
  mapQuoteInvoiceLines,
  quoteNetFirstTotals,
  type QuoteInvoiceSource
} from './quote-invoice-lines'

function assertSzamlazzValid(lines: NetFirstInvoiceLine[], due: number) {
  let sum = 0
  for (const l of lines) {
    assert.equal(l.lineNet + l.lineVat, l.lineGross, `${l.name}: net+vat≠gross`)
    assert.equal(
      l.lineVat,
      vatFromNet(l.lineNet, l.vatPercent),
      `${l.name}: vat ${l.lineVat} ≠ round(${l.lineNet}×${l.vatPercent}/100)`
    )
    assert.ok(Number.isInteger(l.lineNet) && Number.isInteger(l.lineVat))
    assert.ok(l.quantity > 0)
    sum += l.lineGross
  }
  assert.equal(sum, due)
}

let seed = 42
function rand(): number {
  seed = (seed * 1103515245 + 12345) % 2147483648
  return seed / 2147483648
}
function randInt(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

describe('vat-split', () => {
  it('vatFromNet rounds half away from zero', () => {
    assert.equal(vatFromNet(50, 27), 14)
    assert.equal(vatFromNet(-50, 27), -14)
    assert.equal(vatFromNet(121126, 27), 32704)
    assert.equal(vatFromNet(1000, 0), 0)
  })

  it('exactNetForGross finds the unique net or null', () => {
    for (let g = 1; g <= 20000; g++) {
      const n = exactNetForGross(g, 27)
      if (n != null) assert.equal(n + vatFromNet(n, 27), g)
    }
    assert.equal(exactNetForGross(500, 0), 500)
  })

  it('splitGross always keeps net + vat = gross', () => {
    for (let g = -5000; g <= 5000; g++) {
      const s = splitGross(g, 27)
      assert.equal(s.net + s.vat, g)
      if (s.exact) assert.ok(isValidVatForNet(s.net, s.vat, 27))
    }
  })
})

describe('fitNetFirstLines', () => {
  it('random multi-rate invoices are always Számlázz-valid and exact', () => {
    const rates = [0, 5, 18, 27]
    for (let run = 0; run < 3000; run++) {
      const count = randInt(1, 6)
      const targets: GrossTargetLine[] = []
      for (let i = 0; i < count; i++) {
        targets.push({
          name: `T${i}`,
          quantity: rand() < 0.5 ? randInt(1, 12) : Math.round(rand() * 900 + 1) / 100,
          unit: 'db',
          vatPercent: rates[randInt(0, rates.length - 1)]!,
          gross: randInt(1, 5_000_000)
        })
      }
      if (rand() < 0.3) {
        const credit = -randInt(1, Math.floor(targets[0]!.gross / 2) || 1)
        targets.push({ name: 'Jóváírás', quantity: 1, unit: 'db', vatPercent: 27, gross: credit })
      }
      const due = targets.reduce((s, t) => s + t.gross, 0)
      const res = fitNetFirstLines(targets, due)
      assert.ok(res.ok, res.ok ? '' : res.message)
      if (res.ok) assertSzamlazzValid(res.lines, due)
    }
  })

  it('absorbs a ±2 Ft legacy snapshot difference into a valid line', () => {
    const res = fitNetFirstLines(
      [
        { name: 'A', quantity: 1, unit: 'db', vatPercent: 27, gross: 153834 },
        { name: 'B', quantity: 1, unit: 'db', vatPercent: 27, gross: 75958 }
      ],
      153834 + 75958 + 2,
      { tolerance: 2 }
    )
    assert.ok(res.ok)
    if (res.ok) assertSzamlazzValid(res.lines, 153834 + 75958 + 2)
  })

  it('rejects larger differences instead of a silent fallback', () => {
    const res = fitNetFirstLines(
      [{ name: 'A', quantity: 1, unit: 'db', vatPercent: 27, gross: 1000 }],
      1010,
      { tolerance: 2 }
    )
    assert.equal(res.ok, false)
  })

  it('keeps 0% VAT lines at 0%', () => {
    const res = fitNetFirstLines(
      [{ name: 'Mentes', quantity: 1, unit: 'db', vatPercent: 0, gross: 12345 }],
      12345
    )
    assert.ok(res.ok)
    if (res.ok) {
      assert.equal(res.lines[0]!.vatPercent, 0)
      assert.equal(res.lines[0]!.lineVat, 0)
    }
  })

  it('does not split 1 m² Táblás anyag into 0.5+0.5 with different unit prices', () => {
    // 5383 nem elérhető 27%-on; mohó −1 → 5382, de szabás +1 (3116) sem.
    // Elvárt: anyag 5384 + szabás 3114, egy anyag-sor 1 m².
    const res = fitNetFirstLines(
      [
        {
          name: 'Táblás anyag',
          quantity: 1,
          unit: 'm²',
          vatPercent: 27,
          gross: 5383
        },
        {
          name: 'Szabás díj',
          quantity: 7.6,
          unit: 'm',
          vatPercent: 27,
          gross: 3115
        }
      ],
      8498
    )
    assert.ok(res.ok, res.ok ? '' : res.message)
    if (!res.ok) return
    assertSzamlazzValid(res.lines, 8498)
    const materials = res.lines.filter((l) => l.name === 'Táblás anyag')
    assert.equal(materials.length, 1)
    assert.equal(materials[0]!.quantity, 1)
    assert.equal(materials[0]!.unit, 'm²')
    const cutting = res.lines.find((l) => l.name === 'Szabás díj')
    assert.ok(cutting)
  })
})

describe('buildAdvanceLines', () => {
  it('every amount is exact, with one or two Előleg lines', () => {
    let twoLine = 0
    for (let amount = 1; amount <= 200_000; amount++) {
      const res = buildAdvanceLines(amount, 'Előleg')
      assert.ok(res.ok)
      if (!res.ok) continue
      assertSzamlazzValid(res.lines, amount)
      assert.ok(res.lines.length <= 2)
      for (const l of res.lines) {
        assert.equal(l.name, 'Előleg')
        assert.equal(l.quantity, 1)
      }
      if (res.lines.length === 2) twoLine++
    }
    assert.ok(twoLine > 0)
  })
})

describe('mapSaleItemsNetFirst', () => {
  it('splits a single unreachable item by quantity', () => {
    let gross = 1000
    while (exactNetForGross(gross, 27) != null) gross++
    const lines = mapSaleItemsNetFirst([
      { name_snapshot: 'Csavar', quantity: 2, unit_shortform: 'db', tax_rate_percent: 27, total_gross: gross }
    ])
    assertSzamlazzValid(lines, gross)
    assert.equal(lines.length, 2)
    assert.equal(lines.reduce((s, l) => s + l.quantity, 0), 2)
  })
})

function quoteSource(
  partial: Partial<QuoteInvoiceSource> & Pick<QuoteInvoiceSource, 'material_lines' | 'final_total_gross'>
): QuoteInvoiceSource {
  return {
    order_number: 'O-TEST',
    quote_number: 'Q-TEST',
    accessories: [],
    fees: [],
    ...partial
  }
}

function ml(
  name: string,
  v: {
    material: [number, number]
    cutting: [number, number]
    edge: [number, number]
  }
): QuoteInvoiceSource['material_lines'][number] {
  return {
    material_name: name,
    vat_rate: 0.27,
    boards_charged: 1,
    charged_sqm: 0,
    waste_multi: 1,
    board_grain_mm: 2800,
    board_cross_mm: 2070,
    material_net: v.material[0],
    material_gross: v.material[1],
    cutting_length_m: 50,
    cutting_net: v.cutting[0],
    cutting_gross: v.cutting[1],
    edge_length_m: v.edge[1] ? 30 : 0,
    edge_net: v.edge[0],
    edge_gross: v.edge[1],
    services: []
  }
}

describe('mapQuoteInvoiceLines — valós rendelések', () => {
  // O-2026-187: Számlázz 260 „Táblás anyag” (régi bontás: áfa 36283 vs 36279)
  const o187 = quoteSource({
    final_total_gross: 315456,
    material_lines: [
      ml('121 FS01 18 Hideg Fehér', {
        material: [121126, 153834],
        cutting: [59809, 75958],
        edge: [33146, 42095]
      }),
      ml('HDF F 3 Fehér 3 mm', {
        material: [13241, 16816],
        cutting: [21065, 26753],
        edge: [0, 0]
      })
    ]
  })

  for (const detailLevel of ['summary', 'by_material'] as const) {
    it(`O-2026-187 ${detailLevel}: valid, exact total`, () => {
      const res = mapQuoteInvoiceLines(o187, { detailLevel })
      assert.ok(res.ok, res.ok ? '' : res.message)
      if (res.ok) assertSzamlazzValid(res.lines, 315456)
    })
  }

  // O-2026-188: jóváírás -59 500 Ft — régen dupla előjel → csendes egysoros fallback
  const o188 = quoteSource({
    final_total_gross: 683219,
    material_lines: [
      ml('1655HG 18 Bronz', {
        material: [331406, 420886],
        cutting: [45635, 57956],
        edge: [107004, 135895]
      }),
      ml('6185', {
        material: [93714, 119017],
        cutting: [4294, 5453],
        edge: [2765, 3512]
      })
    ],
    fees: [
      {
        kind: 'credit',
        fee_name: 'Korrigálás',
        comment: null,
        quantity: 1,
        unit_shortform: 'db',
        tax_rate_percent: 27,
        gross_price: -59500
      }
    ]
  })

  it('O-2026-188: credit stays negative and lines stay itemized', () => {
    const res = mapQuoteInvoiceLines(o188)
    assert.ok(res.ok, res.ok ? '' : res.message)
    if (!res.ok) return
    assertSzamlazzValid(res.lines, 683219)
    const credit = res.lines.find((l) => l.name.startsWith('Jóváírás'))
    assert.ok(credit && credit.lineGross === -59500)
    assert.ok(res.lines.some((l) => l.name === 'Táblás anyag'))
  })

  it('mixed material VAT rates are not merged into one line', () => {
    const src = quoteSource({
      final_total_gross: 153834 + 10500,
      material_lines: [
        ml('A', { material: [121126, 153834], cutting: [0, 0], edge: [0, 0] }),
        { ...ml('B', { material: [10000, 10500], cutting: [0, 0], edge: [0, 0] }), vat_rate: 0.05 }
      ]
    })
    const res = mapQuoteInvoiceLines(src)
    assert.ok(res.ok)
    if (!res.ok) return
    const materials = res.lines.filter((l) => l.name === 'Táblás anyag')
    assert.deepEqual(materials.map((l) => l.vatPercent).sort(), [27, 5].sort())
    assertSzamlazzValid(res.lines, 164334)
  })

  it('quoteNetFirstTotals matches the summary invoice', () => {
    const totals = quoteNetFirstTotals(o187)
    assert.ok(totals)
    assert.equal(totals!.gross, 315456)
    assert.equal(totals!.net + totals!.vat, 315456)
  })
})
