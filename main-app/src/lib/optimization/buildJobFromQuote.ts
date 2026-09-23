/**
 * Rebuild an optimize MaterialData[] job from a saved quote snapshot.
 * Axis convention MUST match OptiClient.optimize request building.
 *
 * DB quote_panels:
 *   width_mm  = hosszúság (grain / length)
 *   height_mm = szélesség (cross / width)
 *
 * Opti API parts:
 *   w_mm = szélesség (cross)  → height_mm
 *   h_mm = hosszúság (grain)  → width_mm
 *
 * Board:
 *   w_mm = material.width_mm  (board_width_mm snapshot)
 *   h_mm = material.length_mm (board_length_mm snapshot)
 */
import { supabaseServer } from '@/lib/supabase-server'
import type { MaterialData, Part } from '@/types/optimization'

export type StoredBaseline = {
  material_id: string
  material_name: string
  boards_used: number
  usage_percentage: number
  cutting_length_m: number
}

export type QuoteOptiJob = {
  quote: {
    id: string
    quote_number: string
    customer_name: string | null
    created_at: string | null
  }
  materials: MaterialData[]
  baseline_stored: StoredBaseline[]
  panel_count: number
}

type MaterialSettingsRow = {
  kerf_mm: number | null
  trim_top_mm: number | null
  trim_right_mm: number | null
  trim_bottom_mm: number | null
  trim_left_mm: number | null
  rotatable: boolean | null
}

export async function buildJobFromQuoteId(
  quoteId: string
): Promise<QuoteOptiJob | null> {
  const [quoteRes, panelsRes, pricingRes] = await Promise.all([
    supabaseServer
      .from('quotes')
      .select(
        `
        id,
        quote_number,
        created_at,
        customers(name)
      `
      )
      .eq('id', quoteId)
      .is('deleted_at', null)
      .single(),
    supabaseServer
      .from('quote_panels')
      .select(
        `
        id,
        material_id,
        width_mm,
        height_mm,
        quantity
      `
      )
      .eq('quote_id', quoteId)
      .order('created_at', { ascending: true }),
    supabaseServer
      .from('quote_materials_pricing')
      .select(
        `
        material_id,
        material_name,
        board_width_mm,
        board_length_mm,
        grain_direction,
        boards_used,
        usage_percentage,
        cutting_length_m
      `
      )
      .eq('quote_id', quoteId)
  ])

  if (quoteRes.error || !quoteRes.data) return null
  if (panelsRes.error || !panelsRes.data?.length) return null

  const panels = panelsRes.data
  const pricing = pricingRes.data || []
  const materialIds = [...new Set(panels.map((p) => p.material_id))]

  const { data: materialsRows } = await supabaseServer
    .from('materials')
    .select(
      `
      id,
      name,
      width_mm,
      length_mm,
      grain_direction,
      material_settings!left(
        kerf_mm,
        trim_top_mm,
        trim_right_mm,
        trim_bottom_mm,
        trim_left_mm,
        rotatable
      )
    `
    )
    .in('id', materialIds)

  const materialsById = new Map(
    (materialsRows || []).map((m) => [m.id as string, m])
  )

  const pricingByMaterial = new Map(
    pricing.map((p) => [p.material_id as string, p])
  )

  const materials: MaterialData[] = []
  let panelCount = 0

  for (const materialId of materialIds) {
    const group = panels.filter((p) => p.material_id === materialId)
    const snap = pricingByMaterial.get(materialId)
    const live = materialsById.get(materialId)
    const settingsRaw = live?.material_settings
    const settings = (
      Array.isArray(settingsRaw) ? settingsRaw[0] : settingsRaw
    ) as MaterialSettingsRow | null

    const grainLocked = Boolean(
      snap?.grain_direction ?? live?.grain_direction ?? false
    )
    // Match OptiClient: allow_rot_90 from material.rotatable as-is
    const materialRotatable = Boolean(settings?.rotatable)

    const parts: Part[] = []
    for (const panel of group) {
      const qty = panel.quantity || 1
      panelCount += qty
      // OptiClient: w_mm = szélesség, h_mm = hosszúság
      // DB: height_mm = szélesség, width_mm = hosszúság
      for (let i = 0; i < qty; i++) {
        parts.push({
          id: `${panel.id}-${i + 1}`,
          w_mm: panel.height_mm,
          h_mm: panel.width_mm,
          qty: 1,
          allow_rot_90: materialRotatable,
          grain_locked: grainLocked
        })
      }
    }

    const boardWidth = snap?.board_width_mm ?? live?.width_mm ?? 0
    const boardLength = snap?.board_length_mm ?? live?.length_mm ?? 0

    if (!boardWidth || !boardLength) continue

    materials.push({
      id: materialId,
      name: snap?.material_name || (live?.name as string) || 'Ismeretlen',
      parts,
      board: {
        w_mm: boardWidth,
        h_mm: boardLength,
        // Match OptiClient: trim_* || 0 when missing
        trim_top_mm: settings?.trim_top_mm ?? 0,
        trim_right_mm: settings?.trim_right_mm ?? 0,
        trim_bottom_mm: settings?.trim_bottom_mm ?? 0,
        trim_left_mm: settings?.trim_left_mm ?? 0
      },
      params: {
        kerf_mm: settings?.kerf_mm ?? 3
      }
    })
  }

  if (materials.length === 0) return null

  const customersRaw = quoteRes.data.customers as
    | { name?: string }
    | { name?: string }[]
    | null
  const customer = Array.isArray(customersRaw) ? customersRaw[0] : customersRaw

  return {
    quote: {
      id: quoteRes.data.id,
      quote_number: quoteRes.data.quote_number,
      customer_name: customer?.name ?? null,
      created_at: quoteRes.data.created_at
    },
    materials,
    baseline_stored: pricing.map((p) => ({
      material_id: p.material_id,
      material_name: p.material_name,
      boards_used: p.boards_used,
      usage_percentage: Number(p.usage_percentage),
      cutting_length_m: Number(p.cutting_length_m)
    })),
    panel_count: panelCount
  }
}
