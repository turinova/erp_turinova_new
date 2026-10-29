import type { OptimizationResult, Placement } from '@/lib/opti/optimization-types'

/** Céges Opti árazási mód (Beállítások). */
export type PricingMode =
  | 'standard'
  | 'always_full_board'
  | 'always_panel_area'

export type OptiServiceType = 'duplungolas' | 'szogvagas' | 'panthelyfuras'

export interface ServiceLinePricing {
  service_type: OptiServiceType
  quantity: number
  unit: string
  unit_price: number
  net_price: number
  vat_rate: number
  vat_amount: number
  gross_price: number
  currency: string
}

export interface MaterialPricing {
  material_id: string
  material_name: string
  on_stock: boolean
  waste_multi: number
  boards: BoardPricing[]
  edge_materials: EdgeMaterialPricing[]
  cutting_cost: CuttingCostPricing | null
  /** Duplung / szög — 0 Ft díjnál is lehet sor (jelölés). */
  additional_services: ServiceLinePricing[]
  total_material_net: number
  total_material_vat: number
  total_material_gross: number
  total_edge_net: number
  total_edge_vat: number
  total_edge_gross: number
  total_cutting_net: number
  total_cutting_vat: number
  total_cutting_gross: number
  total_services_net: number
  total_services_vat: number
  total_services_gross: number
  total_net: number
  total_vat: number
  total_gross: number
  currency: string
}

export interface BoardPricing {
  board_id: number
  usage_percentage: number
  area_m2: number
  charged_area_m2: number
  net_price: number
  vat_amount: number
  gross_price: number
  pricing_method: 'panel_area' | 'full_board'
}

export interface EdgeMaterialPricing {
  edge_material_id: string
  edge_material_name: string
  length_m: number
  length_with_overhang_m: number
  price_per_m: number
  net_price: number
  vat_rate: number
  vat_amount: number
  gross_price: number
  currency: string
}

export interface CuttingCostPricing {
  total_cutting_length_m: number
  /** Nettó Ft/m (ÁFA-bázis). */
  fee_per_meter: number
  /** Bruttó Ft/m — forrásigazság a megjelenítéshez. */
  fee_per_meter_gross: number
  net_price: number
  vat_rate: number
  vat_amount: number
  gross_price: number
  currency: string
}

export interface QuoteResult {
  materials: MaterialPricing[]
  grand_total_net: number
  grand_total_vat: number
  grand_total_gross: number
  currency: string
  pricing_mode: PricingMode
}

export interface MaterialInfo {
  id: string
  name: string
  width_mm: number
  length_mm: number
  on_stock: boolean
  usage_limit: number
  price_per_sqm: number
  vat_rate: number
  waste_multi: number
  currency: string
}

export interface EdgeMaterialInfo {
  id: string
  name: string
  price_per_m: number
  vat_rate: number
  overhang_mm: number
  currency: string
}

export interface PanelEdge {
  edge_material_id: string
  length_mm: number
  quantity: number
}

export interface CuttingFeeInfo {
  fee_per_meter: number
  fee_per_meter_gross: number
  duplungolas_fee_per_sqm: number
  duplungolas_fee_per_sqm_gross: number
  szogvagas_fee_per_panel: number
  szogvagas_fee_per_panel_gross: number
  panthelyfuras_fee_per_hole: number
  panthelyfuras_fee_per_hole_gross: number
  vat_rate: number
  currency: string
  pricing_mode: PricingMode
}

/** Panel megmunkálás a quote calc-hez (anyag szerinti bontás). */
export type PanelWithServices = {
  sheet_material_id: string
  grain_mm: number
  cross_mm: number
  quantity: number
  duplungolas: boolean
  szogvagas: boolean
  panthelyfuras_quantity: number
}

/** HUF: egész Ft — sorösszeg = végösszeg (nincs ±1 Ft round-sum eltérés). */
export function roundMoneyFt(n: number): number {
  return Math.round(n)
}

/**
 * Nettó alap → egész bruttó, majd nettó/ÁFA back-calc.
 * gross = round(netRaw × (1+vat)); net = round(gross / (1+vat)); vat = gross − net.
 */
function moneyFromNet(
  netRaw: number,
  vatRate: number
): { net: number; vat: number; gross: number } {
  const gross = roundMoneyFt(netRaw * (1 + vatRate))
  const net =
    vatRate > 0 ? roundMoneyFt(gross / (1 + vatRate)) : gross
  return { net, vat: gross - net, gross }
}

/**
 * Opti árajánlat — main-app parity + pricing_mode + duplung/szög.
 * Pánthely később. Pénz: egész Ft a számításnál.
 */
export function calculateQuote(
  optimizationResults: OptimizationResult[],
  materials: MaterialInfo[],
  panelEdgesByMaterial: Map<string, PanelEdge[]>,
  edgeMaterials: Map<string, EdgeMaterialInfo>,
  cuttingFeeInfo: CuttingFeeInfo | null = null,
  panelsWithServices: PanelWithServices[] = []
): QuoteResult {
  const materialPricings: MaterialPricing[] = []
  let grandTotalNet = 0
  let grandTotalVat = 0
  let grandTotalGross = 0
  const pricingMode = cuttingFeeInfo?.pricing_mode ?? 'standard'

  for (const result of optimizationResults) {
    const material = materials.find((m) => m.id === result.material_id)
    if (!material) continue

    const materialEdges = panelEdgesByMaterial.get(result.material_id) || []
    const materialPanels = panelsWithServices.filter(
      (p) => p.sheet_material_id === result.material_id
    )
    const materialPricing = calculateMaterialPricing(
      result,
      material,
      materialEdges,
      edgeMaterials,
      cuttingFeeInfo,
      pricingMode,
      materialPanels
    )
    materialPricings.push(materialPricing)

    grandTotalNet += materialPricing.total_net
    grandTotalVat += materialPricing.total_vat
    grandTotalGross += materialPricing.total_gross
  }

  const currency = materials[0]?.currency || 'HUF'

  return {
    materials: materialPricings,
    grand_total_net: grandTotalNet,
    grand_total_vat: grandTotalVat,
    grand_total_gross: grandTotalGross,
    currency,
    pricing_mode: pricingMode
  }
}

function calculateMaterialPricing(
  result: OptimizationResult,
  material: MaterialInfo,
  panelEdges: PanelEdge[],
  edgeMaterials: Map<string, EdgeMaterialInfo>,
  cuttingFeeInfo: CuttingFeeInfo | null,
  pricingMode: PricingMode,
  panels: PanelWithServices[]
): MaterialPricing {
  const boardArea = (material.width_mm * material.length_mm) / 1_000_000
  const boards: BoardPricing[] = []

  const placementsByBoard = new Map<number, Placement[]>()
  result.placements.forEach((placement) => {
    const boardId = placement.board_id || 1
    if (!placementsByBoard.has(boardId)) {
      placementsByBoard.set(boardId, [])
    }
    placementsByBoard.get(boardId)!.push(placement)
  })

  const boardIds = Array.from(placementsByBoard.keys()).sort((a, b) => a - b)

  const forceFull = pricingMode === 'always_full_board'
  const forcePanel = pricingMode === 'always_panel_area'
  const useStockRules = pricingMode === 'standard' && material.on_stock

  if (forceFull || (!forcePanel && !material.on_stock && pricingMode === 'standard')) {
    const boardsUsed = Math.max(result.metrics.boards_used, boardIds.length, 1)
    const totalBoardArea = boardsUsed * boardArea
    const actualUsedArea = result.placements.reduce(
      (sum, p) => sum + p.w_mm * p.h_mm,
      0
    )
    const denom = material.width_mm * material.length_mm * boardsUsed
    const actualUsagePercentage =
      denom > 0 ? (actualUsedArea / denom) * 100 : 0

    const money = moneyFromNet(
      totalBoardArea * material.price_per_sqm,
      material.vat_rate
    )
    // Egész Ft szétosztás: első n−1 floor, utolsó a maradék (Σ = money).
    let allocatedGross = 0
    let allocatedNet = 0
    for (let i = 1; i <= boardsUsed; i++) {
      const isLast = i === boardsUsed
      const gross = isLast
        ? money.gross - allocatedGross
        : Math.floor(money.gross / boardsUsed)
      const net = isLast
        ? money.net - allocatedNet
        : material.vat_rate > 0
          ? roundMoneyFt(gross / (1 + material.vat_rate))
          : gross
      const vat = gross - net
      allocatedGross += gross
      allocatedNet += net
      boards.push({
        board_id: i,
        usage_percentage: actualUsagePercentage,
        area_m2: actualUsedArea / 1_000_000,
        charged_area_m2: boardArea,
        net_price: net,
        vat_amount: vat,
        gross_price: gross,
        pricing_method: 'full_board'
      })
    }
  } else if (useStockRules || forcePanel) {
    for (const boardId of boardIds) {
      const boardPlacements = placementsByBoard.get(boardId) || []
      const boardUsedArea = boardPlacements.reduce(
        (sum, p) => sum + p.w_mm * p.h_mm,
        0
      )
      const boardUsagePercentage =
        boardUsedArea / (material.width_mm * material.length_mm)
      const panelAreaM2 = boardUsedArea / 1_000_000

      const overLimit =
        !forcePanel && boardUsagePercentage >= material.usage_limit

      if (overLimit) {
        const money = moneyFromNet(
          boardArea * material.price_per_sqm,
          material.vat_rate
        )
        boards.push({
          board_id: boardId,
          usage_percentage: boardUsagePercentage * 100,
          area_m2: panelAreaM2,
          charged_area_m2: boardArea,
          net_price: money.net,
          vat_amount: money.vat,
          gross_price: money.gross,
          pricing_method: 'full_board'
        })
      } else {
        const chargedAreaM2 = panelAreaM2 * material.waste_multi
        const money = moneyFromNet(
          chargedAreaM2 * material.price_per_sqm,
          material.vat_rate
        )
        boards.push({
          board_id: boardId,
          usage_percentage: boardUsagePercentage * 100,
          area_m2: panelAreaM2,
          charged_area_m2: chargedAreaM2,
          net_price: money.net,
          vat_amount: money.vat,
          gross_price: money.gross,
          pricing_method: 'panel_area'
        })
      }
    }
  }

  const totalMaterialNet = boards.reduce((sum, b) => sum + b.net_price, 0)
  const totalMaterialVat = boards.reduce((sum, b) => sum + b.vat_amount, 0)
  const totalMaterialGross = boards.reduce((sum, b) => sum + b.gross_price, 0)

  const edgePricings = calculateEdgeMaterialPricing(panelEdges, edgeMaterials)
  const totalEdgeNet = edgePricings.reduce((sum, e) => sum + e.net_price, 0)
  const totalEdgeVat = edgePricings.reduce((sum, e) => sum + e.vat_amount, 0)
  const totalEdgeGross = edgePricings.reduce((sum, e) => sum + e.gross_price, 0)

  const cuttingCostPricing = cuttingFeeInfo
    ? calculateCuttingCost(result, cuttingFeeInfo)
    : null
  const totalCuttingNet = cuttingCostPricing?.net_price || 0
  const totalCuttingVat = cuttingCostPricing?.vat_amount || 0
  const totalCuttingGross = cuttingCostPricing?.gross_price || 0

  const additionalServices = cuttingFeeInfo
    ? calculateAdditionalServices(panels, cuttingFeeInfo)
    : []
  const totalServicesNet = additionalServices.reduce((s, x) => s + x.net_price, 0)
  const totalServicesVat = additionalServices.reduce(
    (s, x) => s + x.vat_amount,
    0
  )
  const totalServicesGross = additionalServices.reduce(
    (s, x) => s + x.gross_price,
    0
  )

  return {
    material_id: material.id,
    material_name: material.name,
    on_stock: material.on_stock,
    waste_multi: material.waste_multi,
    boards,
    edge_materials: edgePricings,
    cutting_cost: cuttingCostPricing,
    additional_services: additionalServices,
    total_material_net: totalMaterialNet,
    total_material_vat: totalMaterialVat,
    total_material_gross: totalMaterialGross,
    total_edge_net: totalEdgeNet,
    total_edge_vat: totalEdgeVat,
    total_edge_gross: totalEdgeGross,
    total_cutting_net: totalCuttingNet,
    total_cutting_vat: totalCuttingVat,
    total_cutting_gross: totalCuttingGross,
    total_services_net: totalServicesNet,
    total_services_vat: totalServicesVat,
    total_services_gross: totalServicesGross,
    total_net:
      totalMaterialNet + totalEdgeNet + totalCuttingNet + totalServicesNet,
    total_vat:
      totalMaterialVat + totalEdgeVat + totalCuttingVat + totalServicesVat,
    total_gross:
      totalMaterialGross +
      totalEdgeGross +
      totalCuttingGross +
      totalServicesGross,
    currency: material.currency
  }
}

function calculateAdditionalServices(
  panels: PanelWithServices[],
  feeInfo: CuttingFeeInfo
): ServiceLinePricing[] {
  let duplungArea = 0
  let szogPanels = 0
  let panthelyHoles = 0

  for (const panel of panels) {
    if (panel.duplungolas) {
      duplungArea +=
        ((panel.grain_mm * panel.cross_mm) / 1_000_000) * panel.quantity
    }
    if (panel.szogvagas) {
      szogPanels += panel.quantity
    }
    const holes = Number(panel.panthelyfuras_quantity) || 0
    if (holes >= 2) {
      panthelyHoles += holes * panel.quantity
    }
  }

  const lines: ServiceLinePricing[] = []
  const vat = feeInfo.vat_rate

  if (duplungArea > 0) {
    const unitNet = feeInfo.duplungolas_fee_per_sqm
    // Tárolt bruttó egységár × m² (ne nettóból számold vissza)
    const unitGross = Math.round(feeInfo.duplungolas_fee_per_sqm_gross)
    const gross = Math.round(unitGross * duplungArea)
    const net = Math.round(gross / (1 + vat))
    lines.push({
      service_type: 'duplungolas',
      quantity: duplungArea,
      unit: 'm²',
      unit_price: unitNet,
      net_price: net,
      vat_rate: vat,
      vat_amount: gross - net,
      gross_price: gross,
      currency: feeInfo.currency
    })
  }

  if (szogPanels > 0) {
    const unitNet = feeInfo.szogvagas_fee_per_panel
    const unitGross = Math.round(feeInfo.szogvagas_fee_per_panel_gross)
    const gross = unitGross * szogPanels
    const net = Math.round(gross / (1 + vat))
    lines.push({
      service_type: 'szogvagas',
      quantity: szogPanels,
      unit: 'db',
      unit_price: unitNet,
      net_price: net,
      vat_rate: vat,
      vat_amount: gross - net,
      gross_price: gross,
      currency: feeInfo.currency
    })
  }

  if (panthelyHoles > 0) {
    const unitNet = feeInfo.panthelyfuras_fee_per_hole
    const unitGross = Math.round(feeInfo.panthelyfuras_fee_per_hole_gross)
    const gross = unitGross * panthelyHoles
    const net = Math.round(gross / (1 + vat))
    lines.push({
      service_type: 'panthelyfuras',
      quantity: panthelyHoles,
      unit: 'db',
      unit_price: unitNet,
      net_price: net,
      vat_rate: vat,
      vat_amount: gross - net,
      gross_price: gross,
      currency: feeInfo.currency
    })
  }

  return lines
}

function calculateEdgeMaterialPricing(
  panelEdges: PanelEdge[],
  edgeMaterials: Map<string, EdgeMaterialInfo>
): EdgeMaterialPricing[] {
  const edgesById = new Map<string, number>()

  for (const panelEdge of panelEdges) {
    if (!panelEdge.edge_material_id) continue
    const current = edgesById.get(panelEdge.edge_material_id) || 0
    edgesById.set(
      panelEdge.edge_material_id,
      current + panelEdge.length_mm * panelEdge.quantity
    )
  }

  const result: EdgeMaterialPricing[] = []

  for (const [edgeId, totalLengthMm] of edgesById.entries()) {
    const edgeInfo = edgeMaterials.get(edgeId)
    if (!edgeInfo) continue

    const lengthM = totalLengthMm / 1000
    const totalQuantity = panelEdges
      .filter((e) => e.edge_material_id === edgeId)
      .reduce((sum, e) => sum + e.quantity, 0)
    const overhangLengthMm = totalQuantity * edgeInfo.overhang_mm
    const lengthWithOverhangM = (totalLengthMm + overhangLengthMm) / 1000

    const money = moneyFromNet(
      lengthWithOverhangM * edgeInfo.price_per_m,
      edgeInfo.vat_rate
    )

    result.push({
      edge_material_id: edgeId,
      edge_material_name: edgeInfo.name,
      length_m: lengthM,
      length_with_overhang_m: lengthWithOverhangM,
      price_per_m: edgeInfo.price_per_m,
      net_price: money.net,
      vat_rate: edgeInfo.vat_rate,
      vat_amount: money.vat,
      gross_price: money.gross,
      currency: edgeInfo.currency
    })
  }

  return result
}

function calculateCuttingCost(
  result: OptimizationResult,
  cuttingFeeInfo: CuttingFeeInfo
): CuttingCostPricing {
  const totalCuttingLengthMm = result.metrics.total_cut_length_mm || 0
  const totalCuttingLengthM = totalCuttingLengthMm / 1000
  const vat = cuttingFeeInfo.vat_rate
  const unitGross = Math.round(cuttingFeeInfo.fee_per_meter_gross)
  const gross = Math.round(unitGross * totalCuttingLengthM)
  const net = vat > 0 ? Math.round(gross / (1 + vat)) : gross

  return {
    total_cutting_length_m: totalCuttingLengthM,
    fee_per_meter: cuttingFeeInfo.fee_per_meter,
    fee_per_meter_gross: unitGross,
    net_price: net,
    vat_rate: vat,
    vat_amount: gross - net,
    gross_price: gross,
    currency: cuttingFeeInfo.currency
  }
}

export function formatQuotePrice(
  amount: number,
  currency: string = 'HUF'
): string {
  const rounded = Math.round(amount)
  const formatted = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return currency === 'HUF' ? `${formatted} Ft` : `${formatted} ${currency}`
}

export const PRICING_MODE_LABELS: Record<PricingMode, string> = {
  standard: 'Standard — küszöbös',
  always_full_board: 'Mindig teljes tábla',
  always_panel_area: 'Mindig a kivágott lapok szerint'
}
