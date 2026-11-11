import {
  calculateAdditionalServices,
  calculateEdgeMaterialPricing,
  type CuttingFeeInfo,
  type EdgeMaterialInfo,
  type PanelEdge,
  type PanelWithServices,
  type PricingMode
} from '@/lib/opti/quote-calculations'

/**
 * Partner beküldés: a böngészőben számolt, mentett árak egyeznek-e a mai
 * árlistával. Mennyiség (táblák, m², vágási hossz) a mentésből jön, az ár a katalógusból.
 */

export type PriceCheckPanel = {
  sheet_material_id: string
  grain_mm: number
  cross_mm: number
  quantity: number
  edge_a_id: string | null
  edge_b_id: string | null
  edge_c_id: string | null
  edge_d_id: string | null
  duplungolas: boolean
  szogvagas: boolean
  panthelyfuras_quantity: number
}

export type PriceCheckLine = {
  sheet_material_id: string
  board_grain_mm: number
  board_cross_mm: number
  on_stock: boolean
  price_per_sqm: number
  vat_rate: number
  usage_limit: number
  waste_multi: number
  boards_charged: number
  charged_sqm: number
  material_gross: number
  edge_gross: number
  cutting_length_m: number
  cutting_gross: number
  total_gross: number
  edges: { edge_material_id: string; gross_price: number }[]
  services: { service_type: string; gross_price: number }[]
}

export type PriceCheckSheet = {
  id: string
  length_mm: number
  width_mm: number
  on_stock: boolean
  price_net: number
  usage_limit: number
  waste_multi: number
  vat_rate_percent: number
}

export type PriceCheckEdge = {
  id: string
  name: string
  price_net: number
  allowance_mm: number
  vat_rate_percent: number
}

export type PriceCheckInput = {
  quoteTotalGross: number
  quotePricingMode: PricingMode | string | null
  panels: PriceCheckPanel[]
  lines: PriceCheckLine[]
  sheets: PriceCheckSheet[]
  edges: PriceCheckEdge[]
  cuttingFee: CuttingFeeInfo | null
}

export type PriceCheckIssue =
  | 'unavailable'
  | 'pricing_mode'
  | 'material_settings'
  | 'material_price'
  | 'material_quantity'
  | 'edge'
  | 'cutting'
  | 'services'
  | 'totals'

export type PriceCheckResult =
  | { ok: true }
  | { ok: false; issue: PriceCheckIssue; detail: string }

const EPS = 1e-6

function near(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol + EPS
}

function fail(issue: PriceCheckIssue, detail: string): PriceCheckResult {
  return { ok: false, issue, detail }
}

function emptyFee(mode: PricingMode): CuttingFeeInfo {
  return {
    fee_per_meter: 0,
    fee_per_meter_gross: 0,
    duplungolas_fee_per_sqm: 0,
    duplungolas_fee_per_sqm_gross: 0,
    szogvagas_fee_per_panel: 0,
    szogvagas_fee_per_panel_gross: 0,
    panthelyfuras_fee_per_hole: 0,
    panthelyfuras_fee_per_hole_gross: 0,
    vat_rate: 0,
    currency: 'HUF',
    pricing_mode: mode
  }
}

export function checkPartnerQuotePrices(input: PriceCheckInput): PriceCheckResult {
  const fee = input.cuttingFee ?? emptyFee('standard')
  const mode = input.quotePricingMode || 'standard'
  if (mode !== fee.pricing_mode) {
    return fail('pricing_mode', `${mode} → ${fee.pricing_mode}`)
  }
  if (input.lines.length === 0) {
    return fail('totals', 'Nincs árazott anyag.')
  }

  const sheets = new Map(input.sheets.map((s) => [s.id, s]))
  const edgeInfos = new Map<string, EdgeMaterialInfo>()
  for (const e of input.edges) {
    edgeInfos.set(e.id, {
      id: e.id,
      name: e.name,
      price_per_m: e.price_net,
      vat_rate: e.vat_rate_percent / 100,
      overhang_mm: e.allowance_mm,
      currency: 'HUF'
    })
  }

  const lineMaterialIds = new Set(input.lines.map((l) => l.sheet_material_id))
  for (const p of input.panels) {
    if (!lineMaterialIds.has(p.sheet_material_id)) {
      return fail('totals', `Panel árazott anyag nélkül: ${p.sheet_material_id}`)
    }
  }

  let linesGross = 0

  for (const line of input.lines) {
    const sheet = sheets.get(line.sheet_material_id)
    if (!sheet) return fail('unavailable', line.sheet_material_id)

    if (
      !near(sheet.price_net, line.price_per_sqm, 0.005) ||
      !near(sheet.vat_rate_percent / 100, line.vat_rate, 0.0001)
    ) {
      return fail('material_price', line.sheet_material_id)
    }
    if (
      sheet.on_stock !== line.on_stock ||
      !near(sheet.usage_limit, line.usage_limit, 0.0001) ||
      !near(sheet.waste_multi, line.waste_multi, 0.0001) ||
      sheet.length_mm !== line.board_grain_mm ||
      sheet.width_mm !== line.board_cross_mm
    ) {
      return fail('material_settings', line.sheet_material_id)
    }

    const panels = input.panels.filter(
      (p) => p.sheet_material_id === line.sheet_material_id
    )
    if (panels.length === 0) {
      return fail('totals', `Anyag panel nélkül: ${line.sheet_material_id}`)
    }
    const pieces = panels.reduce((s, p) => s + p.quantity, 0)

    // Anyag: táblánként egész Ft kerekítés → max fél Ft / tábla eltérés.
    const boardArea = (sheet.length_mm * sheet.width_mm) / 1_000_000
    const chargedArea = line.boards_charged * boardArea + line.charged_sqm
    const vat = sheet.vat_rate_percent / 100
    const expectedMaterial = chargedArea * sheet.price_net * (1 + vat)
    const materialTol = 2 + 0.5 * (line.boards_charged + pieces)
    if (!near(line.material_gross, expectedMaterial, materialTol)) {
      return fail(
        'material_price',
        `${line.sheet_material_id}: ${line.material_gross} ≠ ${Math.round(expectedMaterial)}`
      )
    }

    // Felszámolt terület nem lehet kisebb a panelek területénél.
    const panelArea = panels.reduce(
      (s, p) => s + ((p.grain_mm * p.cross_mm) / 1_000_000) * p.quantity,
      0
    )
    const waste = line.waste_multi > 0 ? line.waste_multi : 1
    const coveredArea =
      line.boards_charged * boardArea + line.charged_sqm / Math.max(waste, 1)
    if (coveredArea + 0.001 < panelArea) {
      return fail(
        'material_quantity',
        `${line.sheet_material_id}: ${coveredArea.toFixed(3)} < ${panelArea.toFixed(3)} m²`
      )
    }

    // Élzáró: a panelekből pontosan újraszámolható.
    const panelEdges: PanelEdge[] = []
    for (const p of panels) {
      const push = (id: string | null, len: number) => {
        if (id) {
          panelEdges.push({ edge_material_id: id, length_mm: len, quantity: p.quantity })
        }
      }
      push(p.edge_a_id, p.grain_mm)
      push(p.edge_b_id, p.cross_mm)
      push(p.edge_c_id, p.grain_mm)
      push(p.edge_d_id, p.cross_mm)
    }
    for (const pe of panelEdges) {
      if (!edgeInfos.has(pe.edge_material_id)) {
        return fail('unavailable', pe.edge_material_id)
      }
    }
    const expectedEdges = calculateEdgeMaterialPricing(panelEdges, edgeInfos)
    if (expectedEdges.length !== line.edges.length) {
      return fail('edge', `${line.sheet_material_id}: élzáró sorok száma`)
    }
    for (const exp of expectedEdges) {
      const stored = line.edges.find(
        (e) => e.edge_material_id === exp.edge_material_id
      )
      if (!stored || !near(stored.gross_price, exp.gross_price, 1)) {
        return fail('edge', exp.edge_material_id)
      }
    }
    const edgeSum = line.edges.reduce((s, e) => s + e.gross_price, 0)
    if (!near(edgeSum, line.edge_gross, 1)) {
      return fail('edge', `${line.sheet_material_id}: élzáró összeg`)
    }

    // Vágás: mentett hossz × mai bruttó Ft/m.
    const unitGross = Math.round(fee.fee_per_meter_gross)
    const expectedCutting = Math.round(unitGross * line.cutting_length_m)
    if (!near(line.cutting_gross, expectedCutting, 1 + unitGross * 0.0001)) {
      return fail(
        'cutting',
        `${line.sheet_material_id}: ${line.cutting_gross} ≠ ${expectedCutting}`
      )
    }

    // Megmunkálás: panelekből pontosan.
    const withServices: PanelWithServices[] = panels.map((p) => ({
      sheet_material_id: p.sheet_material_id,
      grain_mm: p.grain_mm,
      cross_mm: p.cross_mm,
      quantity: p.quantity,
      duplungolas: p.duplungolas,
      szogvagas: p.szogvagas,
      panthelyfuras_quantity: p.panthelyfuras_quantity
    }))
    const expectedServices = calculateAdditionalServices(withServices, fee)
    if (expectedServices.length !== line.services.length) {
      return fail('services', `${line.sheet_material_id}: sorok száma`)
    }
    for (const exp of expectedServices) {
      const stored = line.services.find((s) => s.service_type === exp.service_type)
      if (!stored || !near(stored.gross_price, exp.gross_price, 1)) {
        return fail('services', `${line.sheet_material_id}: ${exp.service_type}`)
      }
    }
    const servicesSum = line.services.reduce((s, x) => s + x.gross_price, 0)

    const lineSum =
      line.material_gross + line.edge_gross + line.cutting_gross + servicesSum
    if (!near(lineSum, line.total_gross, 1)) {
      return fail('totals', `${line.sheet_material_id}: sor összeg`)
    }
    linesGross += line.total_gross
  }

  if (!near(linesGross, input.quoteTotalGross, 1)) {
    return fail('totals', `${linesGross} ≠ ${input.quoteTotalGross}`)
  }

  return { ok: true }
}

/** Partnernek mutatott üzenet (egy ige + mit tegyen). */
export function priceCheckMessage(result: PriceCheckResult): string {
  if (result.ok) return ''
  if (result.issue === 'unavailable') {
    return 'Az ajánlat egyik anyaga már nem rendelhető. Nyisd meg az ajánlatot, cseréld le, és mentsd újra.'
  }
  return 'Az árak változtak az ajánlat mentése óta. Nyisd meg és mentsd újra az ajánlatot, utána beküldheted.'
}
