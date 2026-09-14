import type { OptiPanelDraft } from '@/lib/opti/panel-draft'
import type { OptiRunResult } from '@/lib/opti/build-optimize-request'
import {
  calculateQuote,
  type CuttingFeeInfo,
  type EdgeMaterialInfo,
  type MaterialInfo,
  type PanelEdge,
  type QuoteResult
} from '@/lib/opti/quote-calculations'
import {
  formatEdgeMaterialLabel,
  type OptiEdgeMaterialOption,
  type OptiSheetMaterialOption
} from '@/lib/opti/queries'
import type { OptiCuttingFeeConfig } from '@/lib/cutting-fees/queries'

/** Panelek + opti eredmény → árajánlat. */
export function buildOptiQuote(input: {
  optiResult: OptiRunResult
  panels: OptiPanelDraft[]
  sheetMaterials: OptiSheetMaterialOption[]
  edgeMaterials: OptiEdgeMaterialOption[]
  cuttingFee: OptiCuttingFeeConfig | null
}): QuoteResult | null {
  const { optiResult, panels, sheetMaterials, edgeMaterials, cuttingFee } =
    input

  if (optiResult.materials.length === 0) return null

  const materialInfos: MaterialInfo[] = []
  for (const result of optiResult.materials) {
    const material = sheetMaterials.find((m) => m.id === result.material_id)
    if (!material) continue
    materialInfos.push({
      id: material.id,
      name: material.name,
      width_mm: material.width_mm,
      length_mm: material.length_mm,
      on_stock: material.on_stock,
      usage_limit: material.usage_limit,
      price_per_sqm: material.price_net,
      vat_rate: material.vat_rate_percent / 100,
      waste_multi: material.waste_multi,
      currency: 'HUF'
    })
  }

  if (materialInfos.length === 0) return null

  const panelEdgesByMaterial = new Map<string, PanelEdge[]>()
  for (const panel of panels) {
    const edges = panelEdgesByMaterial.get(panel.sheetMaterialId) ?? []
    const push = (edgeId: string | null, lengthMm: number) => {
      if (!edgeId) return
      edges.push({
        edge_material_id: edgeId,
        length_mm: lengthMm,
        quantity: panel.quantity
      })
    }
    // A/C = szál (grain), B/D = kereszt (cross) — main parity
    push(panel.edgeAId, panel.grainMm)
    push(panel.edgeBId, panel.crossMm)
    push(panel.edgeCId, panel.grainMm)
    push(panel.edgeDId, panel.crossMm)
    panelEdgesByMaterial.set(panel.sheetMaterialId, edges)
  }

  const edgeMap = new Map<string, EdgeMaterialInfo>()
  for (const em of edgeMaterials) {
    edgeMap.set(em.id, {
      id: em.id,
      name: formatEdgeMaterialLabel(em),
      price_per_m: em.price_net,
      vat_rate: em.vat_rate_percent / 100,
      overhang_mm: em.allowance_mm,
      currency: 'HUF'
    })
  }

  const cuttingFeeInfo: CuttingFeeInfo | null = cuttingFee
    ? {
        fee_per_meter: cuttingFee.fee_per_meter,
        vat_rate: cuttingFee.tax_rate_percent / 100,
        currency: 'HUF',
        pricing_mode: cuttingFee.pricing_mode
      }
    : {
        fee_per_meter: 0,
        vat_rate: 0,
        currency: 'HUF',
        pricing_mode: 'standard'
      }

  return calculateQuote(
    optiResult.materials,
    materialInfos,
    panelEdgesByMaterial,
    edgeMap,
    cuttingFeeInfo
  )
}
