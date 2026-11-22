import type { SupabaseClient } from '@supabase/supabase-js'

import {
  kioskLinesToOptiPanels,
  type KioskPriceLineInput
} from '@/lib/kiosk/map-to-opti'
import { fullBoardReason, type FullBoardReason } from '@/lib/kiosk/leftover'
import { getKioskSettings } from '@/lib/kiosk/settings-queries'
import {
  getCuttingFee,
  toOptiCuttingFeeConfig
} from '@/lib/cutting-fees/queries'
import { buildOptiQuote } from '@/lib/opti/build-opti-quote'
import {
  buildOptimizeRequest,
  summarizeOptimizeResults,
  type OptiRunResult
} from '@/lib/opti/build-optimize-request'
import type { OptimizationResult } from '@/lib/opti/optimization-types'
import type { OptiPanelDraft } from '@/lib/opti/panel-draft'
import type {
  MaterialPricing,
  OptiServiceType,
  PricingMode,
  QuoteResult
} from '@/lib/opti/quote-calculations'
import {
  listOptiEdgeMaterials,
  listOptiSheetMaterials,
  maxCrossMm,
  maxGrainMm,
  type OptiSheetMaterialOption
} from '@/lib/opti/queries'

export type KioskPriceBreakdown = {
  materialGross: number
  edgeGross: number
  cuttingGross: number
  servicesGross: number
}

export type KioskPriceBoardExplain = {
  boardId: number
  gross: number
  pricingMethod: 'panel_area' | 'full_board'
  /** Panel területe (m²), hulladékszorzó előtt. */
  areaM2: number
  /** Számlázott m² (teljes tábla VAGY panel × hulladékszorzó). */
  chargedAreaM2: number
  /** Bruttó Ft/m² a charged_area alapján. */
  pricePerSqmGross: number
}

export type KioskPriceEdgeExplain = {
  name: string
  lengthM: number
  pricePerMGross: number
  gross: number
}

export type KioskPriceServiceExplain = {
  label: string
  qty: number
  unit: string
  unitPriceGross: number
  gross: number
}

/** Anyag-szintű ár-magyarázó (kosár „Hogyan jött ki ez az ár?”). */
export type KioskPriceMaterialExplain = {
  materialId: string
  materialName: string
  pricingMode: PricingMode
  wasteMulti: number
  materialGross: number
  edgeGross: number
  cuttingGross: number
  servicesGross: number
  totalGross: number
  boards: KioskPriceBoardExplain[]
  edges: KioskPriceEdgeExplain[]
  cutting: {
    lengthM: number
    feePerMGross: number
    gross: number
  } | null
  services: KioskPriceServiceExplain[]
  fullBoardReason: FullBoardReason
  fullBoardCount: number
}

export type KioskPriceSuccess = {
  totalGross: number
  totalNet: number
  unplacedCount: number
  boardsUsed: number
  /** Cart-szintű összegzés (anyag / él / vágás / megmunkálás). */
  breakdown: KioskPriceBreakdown
  /** Anyagonkénti bontás a magyarázó sheethez. */
  materials: KioskPriceMaterialExplain[]
  /**
   * Tétel bruttó — anyag-total arányos területi allokáció
   * (közös tábla nesting miatt nem „önálló” paneldíj).
   */
  lines: Array<{ id: string; gross: number }>
}

const SERVICE_LABELS: Record<OptiServiceType, string> = {
  duplungolas: 'Duplung',
  szogvagas: 'Szögvágás',
  panthelyfuras: 'Pánthely'
}

function unitFromGross(gross: number, qty: number): number {
  if (!(qty > 0)) return 0
  return Math.round(gross / qty)
}

function mapMaterialExplain(
  m: MaterialPricing,
  pricingMode: PricingMode,
  onStock: boolean
): KioskPriceMaterialExplain {
  const fullBoardCount = m.boards.filter(
    (b) => b.pricing_method === 'full_board'
  ).length
  return {
    fullBoardReason: fullBoardReason(pricingMode, onStock),
    fullBoardCount,
    materialId: m.material_id,
    materialName: m.material_name,
    pricingMode,
    wasteMulti: m.waste_multi,
    materialGross: Math.round(m.total_material_gross),
    edgeGross: Math.round(m.total_edge_gross),
    cuttingGross: Math.round(m.total_cutting_gross),
    servicesGross: Math.round(m.total_services_gross),
    totalGross: Math.round(m.total_gross),
    boards: m.boards.map((b) => {
      const gross = Math.round(b.gross_price)
      return {
        boardId: b.board_id,
        gross,
        pricingMethod: b.pricing_method,
        areaM2: b.area_m2,
        chargedAreaM2: b.charged_area_m2,
        pricePerSqmGross: unitFromGross(gross, b.charged_area_m2)
      }
    }),
    edges: m.edge_materials.map((e) => {
      const gross = Math.round(e.gross_price)
      return {
        name: e.edge_material_name,
        lengthM: e.length_with_overhang_m,
        pricePerMGross: unitFromGross(gross, e.length_with_overhang_m),
        gross
      }
    }),
    cutting: m.cutting_cost
      ? {
          lengthM: m.cutting_cost.total_cutting_length_m,
          feePerMGross: Math.round(m.cutting_cost.fee_per_meter_gross),
          gross: Math.round(m.cutting_cost.gross_price)
        }
      : null,
    services: m.additional_services
      .filter((s) => Math.round(s.gross_price) > 0)
      .map((s) => {
        const gross = Math.round(s.gross_price)
        return {
          label: SERVICE_LABELS[s.service_type] ?? s.service_type,
          qty: s.quantity,
          unit: s.unit,
          unitPriceGross: unitFromGross(gross, s.quantity),
          gross
        }
      })
  }
}

function allocateLineGrosses(
  lines: KioskPriceLineInput[],
  materials: Array<{ material_id: string; total_gross: number }>
): Array<{ id: string; gross: number }> {
  const byId = new Map<string, number>()
  for (const line of lines) byId.set(line.id, 0)

  for (const mat of materials) {
    const matLines = lines.filter((l) => l.sheetId === mat.material_id)
    if (matLines.length === 0) continue
    const areas = matLines.map(
      (l) => Math.max(1, l.grainMm) * Math.max(1, l.crossMm) * l.quantity
    )
    const sumArea = areas.reduce((a, b) => a + b, 0) || 1
    let allocated = 0
    matLines.forEach((line, i) => {
      const prev = byId.get(line.id) ?? 0
      if (i === matLines.length - 1) {
        byId.set(line.id, prev + (mat.total_gross - allocated))
      } else {
        const share = Math.round(mat.total_gross * (areas[i]! / sumArea))
        allocated += share
        byId.set(line.id, prev + share)
      }
    })
  }

  return lines.map((l) => ({ id: l.id, gross: byId.get(l.id) ?? 0 }))
}

export type KioskPriceFailure = {
  message: string
  code?: 'empty' | 'unplaced' | 'optimize' | 'quote' | 'validation' | 'disabled'
}

async function runOptimizeEngine(
  body: ReturnType<typeof buildOptimizeRequest>
): Promise<OptimizationResult[]> {
  const { NextRequest } = await import('next/server')
  const { POST } = await import('@/app/api/optimize/route')
  const req = new NextRequest('http://localhost/api/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      algorithm: 'ensemble',
      sortStrategy: 'height'
    })
  })
  const res = await POST(req)
  const data = (await res.json()) as OptimizationResult[] | { error?: string }
  if (!res.ok || !Array.isArray(data)) {
    throw new Error(
      !Array.isArray(data) && data.error
        ? data.error
        : 'Az árszámítás (nesting) sikertelen.'
    )
  }
  return data
}

export async function calculateKioskCartPrice(
  admin: SupabaseClient,
  tenantId: string,
  lines: KioskPriceLineInput[]
): Promise<{ ok: true; data: KioskPriceSuccess } | { ok: false; error: KioskPriceFailure }> {
  const result = await buildKioskCartQuote(admin, tenantId, lines)
  if (!result.ok) return result
  return { ok: true, data: result.data }
}

export type KioskCartQuote = {
  data: KioskPriceSuccess
  panels: OptiPanelDraft[]
  quote: QuoteResult
  usedSheets: OptiSheetMaterialOption[]
}

/** Ár + mentéshez szükséges Opti panelek / árazás (kiosk submit). */
export async function buildKioskCartQuote(
  admin: SupabaseClient,
  tenantId: string,
  lines: KioskPriceLineInput[]
): Promise<({ ok: true } & KioskCartQuote) | { ok: false; error: KioskPriceFailure }> {
  if (!lines.length) {
    return {
      ok: false,
      error: { code: 'empty', message: 'A kosár üres.' }
    }
  }

  const settings = await getKioskSettings(admin, tenantId)
  if (!settings?.enabled) {
    return {
      ok: false,
      error: { code: 'disabled', message: 'A kiosk ki van kapcsolva.' }
    }
  }

  if (lines.length > settings.maxPanelRows) {
    return {
      ok: false,
      error: {
        code: 'validation',
        message: `Max. ${settings.maxPanelRows} tétel lehet a kosárban.`
      }
    }
  }

  for (const line of lines) {
    if (line.quantity < 1 || line.quantity > settings.maxQtyPerLine) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `Max. ${settings.maxQtyPerLine} db / tétel.`
        }
      }
    }
    if (line.grainMm < 1 || line.crossMm < 1) {
      return {
        ok: false,
        error: { code: 'validation', message: 'Érvénytelen méret.' }
      }
    }
  }

  const [sheets, edges, cuttingFeeRow] = await Promise.all([
    listOptiSheetMaterials(admin, tenantId),
    listOptiEdgeMaterials(admin, tenantId),
    getCuttingFee(admin, tenantId)
  ])

  const sheetById = new Map(sheets.map((s) => [s.id, s]))
  for (const line of lines) {
    const sheet = sheetById.get(line.sheetId)
    if (!sheet) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'Egy lapanyag már nem elérhető. Válassz újra.'
        }
      }
    }
    const gMax = maxGrainMm(sheet)
    const cMax = maxCrossMm(sheet)
    if (gMax <= 0 || cMax <= 0) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: 'Egy lapanyag nem vágható (táblaméret / szélezés).'
        }
      }
    }
    if (line.grainMm > gMax || line.crossMm > cMax) {
      return {
        ok: false,
        error: {
          code: 'validation',
          message: `Méret túl nagy (max ${gMax} × ${cMax} mm). Módosítsd a kosárban.`
        }
      }
    }
  }

  const sheetNames = new Map(
    sheets.map((s) => [s.id, s.name] as const)
  )

  const panels = kioskLinesToOptiPanels({
    lines,
    sheetNames,
    edgeTypeMap: settings.edgeTypeMap,
    edgeMaterials: edges
  })

  const usedSheets = sheets.filter((s) =>
    panels.some((p) => p.sheetMaterialId === s.id)
  )

  const optimizeBody = buildOptimizeRequest(panels, usedSheets)
  if (optimizeBody.materials.length === 0) {
    return {
      ok: false,
      error: { code: 'optimize', message: 'Nincs mit árazni.' }
    }
  }

  let optiResult: OptiRunResult
  try {
    const raw = await runOptimizeEngine(optimizeBody)
    optiResult = summarizeOptimizeResults(raw)
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'optimize',
        message:
          err instanceof Error
            ? err.message
            : 'Nem sikerült kiszámolni az árat.'
      }
    }
  }

  if (optiResult.totalMetrics.total_unplaced_count > 0) {
    return {
      ok: false,
      error: {
        code: 'unplaced',
        message:
          'Nem fér fel a táblára. Módosíts méretet vagy darabszámot, majd számolj újra.'
      }
    }
  }

  const quote = buildOptiQuote({
    optiResult,
    panels,
    sheetMaterials: usedSheets,
    edgeMaterials: edges,
    cuttingFee: toOptiCuttingFeeConfig(cuttingFeeRow)
  })

  if (!quote) {
    return {
      ok: false,
      error: { code: 'quote', message: 'Nem sikerült az árajánlatot összerakni.' }
    }
  }

  const breakdown: KioskPriceBreakdown = {
    materialGross: Math.round(
      quote.materials.reduce((s, m) => s + m.total_material_gross, 0)
    ),
    edgeGross: Math.round(
      quote.materials.reduce((s, m) => s + m.total_edge_gross, 0)
    ),
    cuttingGross: Math.round(
      quote.materials.reduce((s, m) => s + m.total_cutting_gross, 0)
    ),
    servicesGross: Math.round(
      quote.materials.reduce((s, m) => s + m.total_services_gross, 0)
    )
  }

  return {
    ok: true,
    panels,
    quote,
    usedSheets,
    data: {
      totalGross: Math.round(quote.grand_total_gross),
      totalNet: Math.round(quote.grand_total_net),
      unplacedCount: 0,
      boardsUsed: optiResult.totalMetrics.total_boards,
      breakdown,
      materials: quote.materials.map((m) =>
        mapMaterialExplain(
          m,
          quote.pricing_mode,
          sheetById.get(m.material_id)?.on_stock ?? true
        )
      ),
      lines: allocateLineGrosses(
        lines,
        quote.materials.map((m) => ({
          material_id: m.material_id,
          total_gross: m.total_gross
        }))
      )
    }
  }
}
