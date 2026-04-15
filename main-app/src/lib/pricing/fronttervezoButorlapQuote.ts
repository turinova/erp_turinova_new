/**
 * Bútorlap front — ajánlat számítás ugyanazzal a lánccal, mint az /opti oldal:
 * `/api/optimize` + `calculateQuote`.
 *
 * Élzárás: a Fronttervezőben nincs külön oldalankénti választás; mind a négy élre
 * ugyanaz az alap „mély élzárás” díj érvényes.
 *
 * Élzáró anyag: a specifikáció szerint fix (hardcode) `edge_materials` rekordot használunk,
 * ugyanúgy mint az /opti oldal: nettó `price`, `vat.kulcs`, `ráhagyás`.
 */
import {
  calculateQuote,
  type CuttingFeeInfo,
  type EdgeMaterialInfo,
  type MaterialInfo,
  type PanelEdge,
  type PanelWithServices,
  type QuoteResult
} from '@/lib/pricing/quoteCalculations'
import type { OptimizationResult } from '@/types/optimization'

import type { FronttervezoBoardMaterial, PanthelyConfig } from '@/app/(dashboard)/fronttervezo/fronttervezoTypes'

/** Sor — megegyezik a `FronttervezoButorlapSection` `ButorlapLineItem` típusával */
export type FronttervezoButorlapQuoteLine = {
  id: string
  material: FronttervezoBoardMaterial
  magassagMm: number
  szelessegMm: number
  mennyiseg: number
  panthely: PanthelyConfig | null

  /** Opcionális; számításban nem vesz részt */
  megjegyzes?: string
}

export type EdgeMaterialRow = {
  id: string
  type: string
  thickness: number
  width: number
  decor: string
  price: number
  ráhagyás: number | null
  vat: { kulcs: number | null } | null
}

export function formatEdgeMaterialLabel(edge: EdgeMaterialRow | null): string {
  if (!edge) return ''

  return `${edge.type}-${edge.width}/${edge.thickness}-${edge.decor}`
}

type CuttingFeeRow = {
  fee_per_meter?: number | null
  panthelyfuras_fee_per_hole?: number | null
  duplungolas_fee_per_sqm?: number | null
  szogvagas_fee_per_panel?: number | null
  vat?: { kulcs?: number | null } | null
  currencies?: { name?: string | null } | null
}

function boardMaterialToMaterialInfo(m: FronttervezoBoardMaterial): MaterialInfo {
  return {
    id: m.id,
    name: m.name,
    width_mm: m.width_mm,
    length_mm: m.length_mm,
    on_stock: m.on_stock,
    usage_limit: m.usage_limit,
    price_per_sqm: m.price_per_sqm,
    vat_rate: m.vat_percent / 100,
    waste_multi: m.waste_multi,
    currency: 'HUF'
  }
}

function buildOptimizationPayload(lines: FronttervezoButorlapQuoteLine[]) {
  const byMaterial = new Map<string, FronttervezoButorlapQuoteLine[]>()

  for (const line of lines) {
    const id = line.material.id

    if (!byMaterial.has(id)) byMaterial.set(id, [])
    byMaterial.get(id)!.push(line)
  }

  return Array.from(byMaterial.entries()).map(([materialId, rows]) => {
    const first = rows[0].material

    const parts = rows.flatMap(row =>
      Array.from({ length: row.mennyiseg }, (_, i) => ({
        id: `${row.id}-${i + 1}`,
        w_mm: row.szelessegMm,
        h_mm: row.magassagMm,
        qty: 1,
        allow_rot_90: first.rotatable,
        grain_locked: first.grain_direction
      }))
    )

    return {
      id: materialId,
      name: first.name,
      parts,
      board: {
        w_mm: first.width_mm,
        h_mm: first.length_mm,
        trim_top_mm: first.trim_top_mm ?? 0,
        trim_right_mm: first.trim_right_mm ?? 0,
        trim_bottom_mm: first.trim_bottom_mm ?? 0,
        trim_left_mm: first.trim_left_mm ?? 0
      },
      params: {
        kerf_mm: first.kerf_mm ?? 3
      }
    }
  })
}

function buildPanelEdges(
  lines: FronttervezoButorlapQuoteLine[],
  edgeMaterialId: string
): Map<string, PanelEdge[]> {
  const map = new Map<string, PanelEdge[]>()

  for (const row of lines) {
    const id = row.material.id

    if (!map.has(id)) map.set(id, [])
    const edges = map.get(id)!
    const q = row.mennyiseg
    const h = row.magassagMm
    const w = row.szelessegMm

    /** Opti: A/C = hosszúság (szálirány), B/D = szélesség (keresztirány) */
    edges.push(
      { edge_material_name: edgeMaterialId, length_mm: h, quantity: q },
      { edge_material_name: edgeMaterialId, length_mm: w, quantity: q },
      { edge_material_name: edgeMaterialId, length_mm: h, quantity: q },
      { edge_material_name: edgeMaterialId, length_mm: w, quantity: q }
    )
  }

  return map
}

function buildPanelsByMaterial(lines: FronttervezoButorlapQuoteLine[]): Map<string, PanelWithServices[]> {
  const map = new Map<string, PanelWithServices[]>()

  for (const row of lines) {
    const id = row.material.id

    if (!map.has(id)) map.set(id, [])
    const pant = row.panthely
    const holesPerPanel = pant ? pant.mennyiseg : 0

    const oldal =
      pant?.oldal === 'hosszu' ? 'hosszú' : pant?.oldal === 'rovid' ? 'rövid' : 'hosszú'

    map.get(id)!.push({
      width_mm: row.szelessegMm,
      height_mm: row.magassagMm,
      quantity: row.mennyiseg,
      panthelyfuras_quantity: holesPerPanel,
      panthelyfuras_side: oldal,
      duplungolas: false,
      szogvagas: false
    })
  }

  return map
}

function buildDefaultEdgeMap(edge: EdgeMaterialRow | null): Map<string, EdgeMaterialInfo> {
  if (!edge) return new Map()
  const vat = (edge.vat?.kulcs ?? 27) / 100

  return new Map<string, EdgeMaterialInfo>([
    [
      edge.id,
      {
        name: formatEdgeMaterialLabel(edge) || 'Élzáró',
        price_per_m: edge.price || 0,
        vat_rate: vat,
        overhang_mm: edge.ráhagyás ?? 0,
        currency: 'HUF'
      }
    ]
  ])
}

function cuttingFeeToInfo(cuttingFee: CuttingFeeRow | null): CuttingFeeInfo | null {
  if (!cuttingFee) {
    return {
      fee_per_meter: 0,
      panthelyfuras_fee_per_hole: 50,
      duplungolas_fee_per_sqm: 200,
      szogvagas_fee_per_panel: 100,
      vat_rate: 0.27,
      currency: 'HUF'
    }
  }

  return {
    fee_per_meter: cuttingFee.fee_per_meter ?? 0,
    panthelyfuras_fee_per_hole: cuttingFee.panthelyfuras_fee_per_hole ?? 50,
    duplungolas_fee_per_sqm: cuttingFee.duplungolas_fee_per_sqm ?? 200,
    szogvagas_fee_per_panel: cuttingFee.szogvagas_fee_per_panel ?? 100,
    vat_rate: (cuttingFee.vat?.kulcs ?? 27) / 100,
    currency: cuttingFee.currencies?.name || 'HUF'
  }
}

export type FronttervezoButorlapQuoteOutcome =
  | { ok: true; quote: QuoteResult; optimizationResults: OptimizationResult[] }
  | { ok: false; error: string }

export async function computeFronttervezoButorlapQuote(
  lines: FronttervezoButorlapQuoteLine[],
  cuttingFee: CuttingFeeRow | null,
  edgeMaterial: EdgeMaterialRow | null
): Promise<FronttervezoButorlapQuoteOutcome> {
  if (!lines.length) {
    return { ok: false, error: 'Nincs tétel a listában.' }
  }

  if (!edgeMaterial?.id) {
    return { ok: false, error: 'Hiányzó élzáró anyag beállítás.' }
  }

  const materialIds = new Set(lines.map(l => l.material.id))

  const materialInfos: MaterialInfo[] = Array.from(materialIds).map(mid => {
    const row = lines.find(l => l.material.id === mid)

    return row ? boardMaterialToMaterialInfo(row.material) : null
  }).filter(Boolean) as MaterialInfo[]

  const payload = buildOptimizationPayload(lines)
  const edgeMap = buildDefaultEdgeMap(edgeMaterial)
  const cuttingFeeInfo = cuttingFeeToInfo(cuttingFee)
  const panelEdges = buildPanelEdges(lines, edgeMaterial.id)
  const panelsByMaterial = buildPanelsByMaterial(lines)

  try {
    const response = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        materials: payload,
        algorithm: 'multipanel',
        sortStrategy: 'height'
      })
    })

    if (!response.ok) {
      const text = await response.text()

      return { ok: false, error: text || `Optimalizálás hiba (${response.status})` }
    }

    const results = (await response.json()) as OptimizationResult[]

    if (!Array.isArray(results) || results.length === 0) {
      return { ok: false, error: 'Üres optimalizálási válasz.' }
    }

    const quote = calculateQuote(
      results,
      materialInfos,
      panelEdges,
      edgeMap,
      cuttingFeeInfo,
      panelsByMaterial
    )

    return { ok: true, quote, optimizationResults: results }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ismeretlen hiba'

    return { ok: false, error: msg }
  }
}
