import type { OptimizationResult, Placement } from '@/lib/opti/optimization-types'

/** Céges Opti árazási mód (Beállítások). */
export type PricingMode =
  | 'standard'
  | 'always_full_board'
  | 'always_panel_area'

export interface MaterialPricing {
  material_id: string
  material_name: string
  on_stock: boolean
  waste_multi: number
  boards: BoardPricing[]
  edge_materials: EdgeMaterialPricing[]
  cutting_cost: CuttingCostPricing | null
  total_material_net: number
  total_material_vat: number
  total_material_gross: number
  total_edge_net: number
  total_edge_vat: number
  total_edge_gross: number
  total_cutting_net: number
  total_cutting_vat: number
  total_cutting_gross: number
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
  fee_per_meter: number
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
  vat_rate: number
  currency: string
  pricing_mode: PricingMode
}

/**
 * Opti árajánlat — main-app quoteCalculations parity + pricing_mode.
 * V1: nincs pánthely / duplung / szögvágás.
 */
export function calculateQuote(
  optimizationResults: OptimizationResult[],
  materials: MaterialInfo[],
  panelEdgesByMaterial: Map<string, PanelEdge[]>,
  edgeMaterials: Map<string, EdgeMaterialInfo>,
  cuttingFeeInfo: CuttingFeeInfo | null = null
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
    const materialPricing = calculateMaterialPricing(
      result,
      material,
      materialEdges,
      edgeMaterials,
      cuttingFeeInfo,
      pricingMode
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
  pricingMode: PricingMode
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

    const netPrice = totalBoardArea * material.price_per_sqm
    const vatAmount = netPrice * material.vat_rate
    const grossPrice = netPrice + vatAmount

    for (let i = 1; i <= boardsUsed; i++) {
      boards.push({
        board_id: i,
        usage_percentage: actualUsagePercentage,
        area_m2: actualUsedArea / 1_000_000,
        charged_area_m2: boardArea,
        net_price: netPrice / boardsUsed,
        vat_amount: vatAmount / boardsUsed,
        gross_price: grossPrice / boardsUsed,
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
        const netPrice = boardArea * material.price_per_sqm
        const vatAmount = netPrice * material.vat_rate
        boards.push({
          board_id: boardId,
          usage_percentage: boardUsagePercentage * 100,
          area_m2: panelAreaM2,
          charged_area_m2: boardArea,
          net_price: netPrice,
          vat_amount: vatAmount,
          gross_price: netPrice + vatAmount,
          pricing_method: 'full_board'
        })
      } else {
        const chargedAreaM2 = panelAreaM2 * material.waste_multi
        const netPrice = chargedAreaM2 * material.price_per_sqm
        const vatAmount = netPrice * material.vat_rate
        boards.push({
          board_id: boardId,
          usage_percentage: boardUsagePercentage * 100,
          area_m2: panelAreaM2,
          charged_area_m2: chargedAreaM2,
          net_price: netPrice,
          vat_amount: vatAmount,
          gross_price: netPrice + vatAmount,
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

  return {
    material_id: material.id,
    material_name: material.name,
    on_stock: material.on_stock,
    waste_multi: material.waste_multi,
    boards,
    edge_materials: edgePricings,
    cutting_cost: cuttingCostPricing,
    total_material_net: totalMaterialNet,
    total_material_vat: totalMaterialVat,
    total_material_gross: totalMaterialGross,
    total_edge_net: totalEdgeNet,
    total_edge_vat: totalEdgeVat,
    total_edge_gross: totalEdgeGross,
    total_cutting_net: totalCuttingNet,
    total_cutting_vat: totalCuttingVat,
    total_cutting_gross: totalCuttingGross,
    total_net: totalMaterialNet + totalEdgeNet + totalCuttingNet,
    total_vat: totalMaterialVat + totalEdgeVat + totalCuttingVat,
    total_gross: totalMaterialGross + totalEdgeGross + totalCuttingGross,
    currency: material.currency
  }
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

    const netPrice = lengthWithOverhangM * edgeInfo.price_per_m
    const vatAmount = netPrice * edgeInfo.vat_rate
    const grossPrice = netPrice + vatAmount

    result.push({
      edge_material_id: edgeId,
      edge_material_name: edgeInfo.name,
      length_m: lengthM,
      length_with_overhang_m: lengthWithOverhangM,
      price_per_m: edgeInfo.price_per_m,
      net_price: netPrice,
      vat_rate: edgeInfo.vat_rate,
      vat_amount: vatAmount,
      gross_price: grossPrice,
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

  const netPrice = totalCuttingLengthM * cuttingFeeInfo.fee_per_meter
  const vatAmount = netPrice * cuttingFeeInfo.vat_rate
  const grossPrice = netPrice + vatAmount

  return {
    total_cutting_length_m: totalCuttingLengthM,
    fee_per_meter: cuttingFeeInfo.fee_per_meter,
    net_price: netPrice,
    vat_rate: cuttingFeeInfo.vat_rate,
    vat_amount: vatAmount,
    gross_price: grossPrice,
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
