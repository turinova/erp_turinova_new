/**
 * Run: npx tsx --test src/lib/quotes/partner-price-check.test.ts
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  checkPartnerQuotePrices,
  priceCheckMessage,
  type PriceCheckInput
} from '@/lib/quotes/partner-price-check'

function baseInput(over: Partial<PriceCheckInput> = {}): PriceCheckInput {
  return {
    quoteTotalGross: 12700,
    quotePricingMode: 'standard',
    panels: [
      {
        sheet_material_id: 'sheet-1',
        grain_mm: 1000,
        cross_mm: 1000,
        quantity: 1,
        edge_a_id: null,
        edge_b_id: null,
        edge_c_id: null,
        edge_d_id: null,
        duplungolas: false,
        szogvagas: false,
        panthelyfuras_quantity: 0
      }
    ],
    lines: [
      {
        sheet_material_id: 'sheet-1',
        board_grain_mm: 2800,
        board_cross_mm: 2070,
        on_stock: true,
        price_per_sqm: 10000,
        vat_rate: 0.27,
        usage_limit: 0.8,
        waste_multi: 1,
        boards_charged: 0,
        charged_sqm: 1,
        material_gross: 12700,
        edge_gross: 0,
        cutting_length_m: 0,
        cutting_gross: 0,
        total_gross: 12700,
        edges: [],
        services: []
      }
    ],
    sheets: [
      {
        id: 'sheet-1',
        length_mm: 2800,
        width_mm: 2070,
        on_stock: true,
        price_net: 10000,
        usage_limit: 0.8,
        waste_multi: 1,
        vat_rate_percent: 27
      }
    ],
    edges: [],
    cuttingFee: {
      fee_per_meter: 100,
      fee_per_meter_gross: 127,
      duplungolas_fee_per_sqm: 0,
      duplungolas_fee_per_sqm_gross: 0,
      szogvagas_fee_per_panel: 0,
      szogvagas_fee_per_panel_gross: 0,
      panthelyfuras_fee_per_hole: 0,
      panthelyfuras_fee_per_hole_gross: 0,
      vat_rate: 0.27,
      currency: 'HUF',
      pricing_mode: 'standard'
    },
    ...over
  }
}

describe('checkPartnerQuotePrices', () => {
  it('elfogadja az egyező árat', () => {
    const result = checkPartnerQuotePrices(baseInput())
    assert.equal(result.ok, true)
  })

  it('elutasítja, ha a katalógusár változott', () => {
    const result = checkPartnerQuotePrices(
      baseInput({
        sheets: [
          {
            id: 'sheet-1',
            length_mm: 2800,
            width_mm: 2070,
            on_stock: true,
            price_net: 11000,
            usage_limit: 0.8,
            waste_multi: 1,
            vat_rate_percent: 27
          }
        ]
      })
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.issue, 'material_price')
  })

  it('elutasítja, ha az anyag már nem aktív', () => {
    const result = checkPartnerQuotePrices(baseInput({ sheets: [] }))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.issue, 'unavailable')
  })

  it('elutasítja, ha a vágási díj változott', () => {
    const result = checkPartnerQuotePrices(
      baseInput({
        quoteTotalGross: 12827,
        lines: [
          {
            ...baseInput().lines[0]!,
            cutting_length_m: 1,
            cutting_gross: 127,
            total_gross: 12827
          }
        ],
        cuttingFee: {
          ...baseInput().cuttingFee!,
          fee_per_meter: 200,
          fee_per_meter_gross: 254
        }
      })
    )
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.issue, 'cutting')
  })
})

describe('priceCheckMessage', () => {
  it('anyag hiányánál cserét kér', () => {
    assert.match(
      priceCheckMessage({ ok: false, issue: 'unavailable', detail: 'x' }),
      /nem rendelhető/
    )
  })

  it('árváltozásnál újramentést kér', () => {
    assert.match(
      priceCheckMessage({ ok: false, issue: 'material_price', detail: 'x' }),
      /árak változtak/i
    )
  })
})
