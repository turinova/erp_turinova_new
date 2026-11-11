import type { SupabaseClient } from '@supabase/supabase-js'

import { getCuttingFee } from '@/lib/cutting-fees/queries'
import type { CuttingFeeInfo } from '@/lib/opti/quote-calculations'
import {
  checkPartnerQuotePrices,
  type PriceCheckEdge,
  type PriceCheckLine,
  type PriceCheckPanel,
  type PriceCheckResult,
  type PriceCheckSheet
} from '@/lib/quotes/partner-price-check'

type TaxJoin = { rate_percent: number | string } | { rate_percent: number | string }[] | null

function taxPercent(t: TaxJoin): number {
  const row = Array.isArray(t) ? t[0] : t
  return Number(row?.rate_percent ?? 0)
}

/** Mentett ajánlat + mai katalógus → ár ellenőrzés (partner vagy service kliens). */
export async function runPartnerQuotePriceCheck(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<PriceCheckResult> {
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select('id, total_gross, pricing_mode')
    .eq('id', quoteId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (quoteErr || !quote) {
    return { ok: false, issue: 'totals', detail: 'quote load' }
  }

  const [panelsRes, linesRes] = await Promise.all([
    supabase
      .from('quote_panels')
      .select(
        'sheet_material_id, grain_mm, cross_mm, quantity, edge_a_id, edge_b_id, edge_c_id, edge_d_id, duplungolas, szogvagas, panthelyfuras_quantity'
      )
      .eq('quote_id', quoteId),
    supabase
      .from('quote_material_lines')
      .select(
        `id, sheet_material_id, board_grain_mm, board_cross_mm, on_stock, price_per_sqm, vat_rate,
         usage_limit, waste_multi, boards_charged, charged_sqm, material_gross, edge_gross,
         cutting_length_m, cutting_gross, total_gross,
         quote_edge_lines ( edge_material_id, gross_price ),
         quote_service_lines ( service_type, gross_price )`
      )
      .eq('quote_id', quoteId)
  ])
  if (panelsRes.error || linesRes.error) {
    console.error(
      'runPartnerQuotePriceCheck load',
      panelsRes.error?.message ?? linesRes.error?.message
    )
    return { ok: false, issue: 'totals', detail: 'lines load' }
  }

  const panels: PriceCheckPanel[] = (panelsRes.data ?? []).map((p) => ({
    sheet_material_id: p.sheet_material_id as string,
    grain_mm: Number(p.grain_mm),
    cross_mm: Number(p.cross_mm),
    quantity: Number(p.quantity),
    edge_a_id: (p.edge_a_id as string | null) ?? null,
    edge_b_id: (p.edge_b_id as string | null) ?? null,
    edge_c_id: (p.edge_c_id as string | null) ?? null,
    edge_d_id: (p.edge_d_id as string | null) ?? null,
    duplungolas: Boolean(p.duplungolas),
    szogvagas: Boolean(p.szogvagas),
    panthelyfuras_quantity: Number(p.panthelyfuras_quantity) || 0
  }))

  const lines: PriceCheckLine[] = (linesRes.data ?? []).map((l) => ({
    sheet_material_id: l.sheet_material_id as string,
    board_grain_mm: Number(l.board_grain_mm),
    board_cross_mm: Number(l.board_cross_mm),
    on_stock: Boolean(l.on_stock),
    price_per_sqm: Number(l.price_per_sqm),
    vat_rate: Number(l.vat_rate),
    usage_limit: Number(l.usage_limit),
    waste_multi: Number(l.waste_multi),
    boards_charged: Number(l.boards_charged) || 0,
    charged_sqm: Number(l.charged_sqm) || 0,
    material_gross: Number(l.material_gross) || 0,
    edge_gross: Number(l.edge_gross) || 0,
    cutting_length_m: Number(l.cutting_length_m) || 0,
    cutting_gross: Number(l.cutting_gross) || 0,
    total_gross: Number(l.total_gross) || 0,
    edges: ((l.quote_edge_lines ?? []) as { edge_material_id: string; gross_price: number }[]).map(
      (e) => ({ edge_material_id: e.edge_material_id, gross_price: Number(e.gross_price) || 0 })
    ),
    services: ((l.quote_service_lines ?? []) as { service_type: string; gross_price: number }[]).map(
      (s) => ({ service_type: s.service_type, gross_price: Number(s.gross_price) || 0 })
    )
  }))

  const sheetIds = [...new Set(lines.map((l) => l.sheet_material_id))]
  const edgeIds = [
    ...new Set(
      panels.flatMap((p) =>
        [p.edge_a_id, p.edge_b_id, p.edge_c_id, p.edge_d_id].filter(
          (x): x is string => Boolean(x)
        )
      )
    )
  ]

  const [sheetsRes, edgesRes, feeRow] = await Promise.all([
    sheetIds.length
      ? supabase
          .from('sheet_materials')
          .select(
            'id, length_mm, width_mm, on_stock, price_net, usage_limit, waste_multi, tax_rates ( rate_percent )'
          )
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .is('deleted_at', null)
          .in('id', sheetIds)
      : Promise.resolve({ data: [], error: null }),
    edgeIds.length
      ? supabase
          .from('edge_materials')
          .select('id, type, price_net, allowance_mm, tax_rates ( rate_percent )')
          .eq('tenant_id', tenantId)
          .eq('active', true)
          .is('deleted_at', null)
          .in('id', edgeIds)
      : Promise.resolve({ data: [], error: null }),
    getCuttingFee(supabase, tenantId)
  ])
  if (sheetsRes.error || edgesRes.error) {
    console.error(
      'runPartnerQuotePriceCheck catalog',
      sheetsRes.error?.message ?? edgesRes.error?.message
    )
    return { ok: false, issue: 'totals', detail: 'catalog load' }
  }

  const sheets: PriceCheckSheet[] = (sheetsRes.data ?? []).map((s) => ({
    id: s.id as string,
    length_mm: Number(s.length_mm),
    width_mm: Number(s.width_mm),
    on_stock: Boolean(s.on_stock),
    price_net: Number(s.price_net),
    usage_limit: Number(s.usage_limit),
    waste_multi: Number(s.waste_multi),
    vat_rate_percent: taxPercent(s.tax_rates as TaxJoin)
  }))

  const edges: PriceCheckEdge[] = (edgesRes.data ?? []).map((e) => ({
    id: e.id as string,
    name: String(e.type ?? ''),
    price_net: Number(e.price_net),
    allowance_mm: Number(e.allowance_mm ?? 0),
    vat_rate_percent: taxPercent(e.tax_rates as TaxJoin)
  }))

  const cuttingFee: CuttingFeeInfo | null = feeRow
    ? {
        fee_per_meter: feeRow.fee_per_meter,
        fee_per_meter_gross: feeRow.fee_per_meter_gross,
        duplungolas_fee_per_sqm: feeRow.duplungolas_fee_per_sqm,
        duplungolas_fee_per_sqm_gross: feeRow.duplungolas_fee_per_sqm_gross,
        szogvagas_fee_per_panel: feeRow.szogvagas_fee_per_panel,
        szogvagas_fee_per_panel_gross: feeRow.szogvagas_fee_per_panel_gross,
        panthelyfuras_fee_per_hole: feeRow.panthelyfuras_fee_per_hole,
        panthelyfuras_fee_per_hole_gross: feeRow.panthelyfuras_fee_per_hole_gross,
        vat_rate: feeRow.tax_rate_percent / 100,
        currency: 'HUF',
        pricing_mode: feeRow.pricing_mode
      }
    : null

  return checkPartnerQuotePrices({
    quoteTotalGross: Number(quote.total_gross) || 0,
    quotePricingMode: (quote.pricing_mode as string | null) ?? 'standard',
    panels,
    lines,
    sheets,
    edges,
    cuttingFee
  })
}
