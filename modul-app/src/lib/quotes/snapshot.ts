import type { OptiPanelDraft } from '@/lib/opti/panel-draft'
import type {
  MaterialPricing,
  PricingMode,
  QuoteResult
} from '@/lib/opti/quote-calculations'
import type { OptiSheetMaterialOption } from '@/lib/opti/queries'

export type QuotePanelInsert = {
  quote_id: string
  sheet_material_id: string
  grain_mm: number
  cross_mm: number
  quantity: number
  label: string | null
  edge_a_id: string | null
  edge_b_id: string | null
  edge_c_id: string | null
  edge_d_id: string | null
  sort_index: number
}

export type QuoteMaterialLineInsert = {
  quote_id: string
  sheet_material_id: string
  material_name: string
  board_grain_mm: number
  board_cross_mm: number
  thickness_mm: number
  on_stock: boolean
  price_per_sqm: number
  vat_rate: number
  usage_limit: number
  waste_multi: number
  boards_charged: number
  charged_sqm: number
  pricing_method: 'full_board' | 'panel_area' | 'mixed'
  material_net: number
  material_vat: number
  material_gross: number
  edge_length_m: number
  edge_net: number
  edge_vat: number
  edge_gross: number
  cutting_length_m: number
  cutting_net: number
  cutting_vat: number
  cutting_gross: number
  total_net: number
  total_vat: number
  total_gross: number
}

export type QuoteEdgeLineInsert = {
  quote_material_line_id: string
  edge_material_id: string
  edge_name: string
  length_m: number
  price_per_m: number
  net_price: number
  vat_amount: number
  gross_price: number
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000
}

function pricingMethodOf(
  material: MaterialPricing
): 'full_board' | 'panel_area' | 'mixed' {
  const methods = new Set(material.boards.map((b) => b.pricing_method))
  if (methods.size === 0) return 'panel_area'
  if (methods.size === 1) {
    return methods.has('full_board') ? 'full_board' : 'panel_area'
  }
  return 'mixed'
}

export function panelsToInserts(
  quoteId: string,
  panels: OptiPanelDraft[]
): QuotePanelInsert[] {
  return panels.map((panel, index) => ({
    quote_id: quoteId,
    sheet_material_id: panel.sheetMaterialId,
    grain_mm: panel.grainMm,
    cross_mm: panel.crossMm,
    quantity: panel.quantity,
    label: panel.marking.trim() || null,
    edge_a_id: panel.edgeAId,
    edge_b_id: panel.edgeBId,
    edge_c_id: panel.edgeCId,
    edge_d_id: panel.edgeDId,
    sort_index: index
  }))
}

export function materialLineFromPricing(
  quoteId: string,
  material: MaterialPricing,
  sheet: OptiSheetMaterialOption | undefined
): QuoteMaterialLineInsert {
  const boardsCharged = material.boards.filter(
    (b) => b.pricing_method === 'full_board'
  ).length
  const chargedSqm = material.boards.reduce(
    (sum, b) => sum + b.charged_area_m2,
    0
  )
  const edgeLengthM = material.edge_materials.reduce(
    (sum, e) => sum + e.length_with_overhang_m,
    0
  )

  return {
    quote_id: quoteId,
    sheet_material_id: material.material_id,
    material_name: material.material_name,
    board_grain_mm: sheet?.length_mm ?? 0,
    board_cross_mm: sheet?.width_mm ?? 0,
    thickness_mm: sheet?.thickness_mm ?? 0,
    on_stock: material.on_stock,
    price_per_sqm: sheet?.price_net ?? 0,
    vat_rate: sheet ? sheet.vat_rate_percent / 100 : 0,
    usage_limit: sheet?.usage_limit ?? 0,
    waste_multi: material.waste_multi,
    boards_charged: boardsCharged,
    charged_sqm: round4(chargedSqm),
    pricing_method: pricingMethodOf(material),
    material_net: round2(material.total_material_net),
    material_vat: round2(material.total_material_vat),
    material_gross: round2(material.total_material_gross),
    edge_length_m: round4(edgeLengthM),
    edge_net: round2(material.total_edge_net),
    edge_vat: round2(material.total_edge_vat),
    edge_gross: round2(material.total_edge_gross),
    cutting_length_m: round4(
      material.cutting_cost?.total_cutting_length_m ?? 0
    ),
    cutting_net: round2(material.total_cutting_net),
    cutting_vat: round2(material.total_cutting_vat),
    cutting_gross: round2(material.total_cutting_gross),
    total_net: round2(material.total_net),
    total_vat: round2(material.total_vat),
    total_gross: round2(material.total_gross)
  }
}

export function edgeLinesFromPricing(
  materialLineId: string,
  material: MaterialPricing
): QuoteEdgeLineInsert[] {
  return material.edge_materials.map((edge) => ({
    quote_material_line_id: materialLineId,
    edge_material_id: edge.edge_material_id,
    edge_name: edge.edge_material_name,
    length_m: round4(edge.length_with_overhang_m),
    price_per_m: edge.price_per_m,
    net_price: round2(edge.net_price),
    vat_amount: round2(edge.vat_amount),
    gross_price: round2(edge.gross_price)
  }))
}

export function assertQuoteReady(input: {
  panels: OptiPanelDraft[]
  quote: QuoteResult
  sheetMaterials: OptiSheetMaterialOption[]
}): string | null {
  if (input.panels.length === 0) return 'Legalább egy panel kell a mentéshez.'
  if (input.quote.materials.length === 0) {
    return 'Nincs árazható anyag — futtasd újra az optimalizálást.'
  }
  for (const panel of input.panels) {
    if (!input.sheetMaterials.some((m) => m.id === panel.sheetMaterialId)) {
      return 'Ismeretlen táblás anyag a panelek között.'
    }
  }
  for (const line of input.quote.materials) {
    const sheet = input.sheetMaterials.find((m) => m.id === line.material_id)
    if (!sheet) return `Hiányzó anyag az árazásban: ${line.material_name}`
    if (sheet.length_mm <= 0 || sheet.width_mm <= 0) {
      return `Érvénytelen lapméret: ${sheet.name}`
    }
  }
  return null
}

export function quotePricingMode(quote: QuoteResult): PricingMode {
  return quote.pricing_mode
}
