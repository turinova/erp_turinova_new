import type { SupabaseClient } from '@supabase/supabase-js'

import type { OptiPanelDraft } from '@/lib/opti/panel-draft'
import type { QuoteResult } from '@/lib/opti/quote-calculations'
import type { OptiSheetMaterialOption } from '@/lib/opti/queries'
import { recalculateQuoteFeeTotals } from '@/lib/quotes/fee-totals'
import {
  edgeLinesFromPricing,
  materialLineFromPricing,
  panelsToInserts,
  serviceLinesFromPricing
} from '@/lib/quotes/snapshot'

/**
 * Ajánlat gyerek-sorai (panelek, anyag-, él-, megmunkálás sorok) + díj összesítők.
 * Staff Opti, partner portál és kiosk ugyanezt használja → nincs eltérő árazás-mentés.
 * Előfeltétel: a quote sor létezik, a régi sorok (szerkesztésnél) törölve.
 */
export async function persistOptiQuoteChildren(input: {
  supabase: SupabaseClient
  tenantId: string
  quoteId: string
  panels: OptiPanelDraft[]
  quote: QuoteResult
  sheetMaterials: OptiSheetMaterialOption[]
  logPrefix?: string
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, tenantId, quoteId } = input
  const log = input.logPrefix ? `${input.logPrefix} ` : ''

  const panelRows = panelsToInserts(quoteId, input.panels)
  const { error: panelsError } = await supabase
    .from('quote_panels')
    .insert(panelRows)

  if (panelsError) {
    console.error(`${log}quote_panels`, panelsError.message)
    return { ok: false, message: 'Nem sikerült menteni a paneleket.' }
  }

  for (const material of input.quote.materials) {
    const sheet = input.sheetMaterials.find((m) => m.id === material.material_id)
    const line = materialLineFromPricing(quoteId, material, sheet)
    const { data: lineRow, error: lineError } = await supabase
      .from('quote_material_lines')
      .insert(line)
      .select('id')
      .single()

    if (lineError || !lineRow) {
      console.error(`${log}quote_material_lines`, lineError?.message)
      return { ok: false, message: 'Nem sikerült menteni az árazást.' }
    }

    const edges = edgeLinesFromPricing(lineRow.id, material)
    if (edges.length > 0) {
      const { error: edgeError } = await supabase
        .from('quote_edge_lines')
        .insert(edges)
      if (edgeError) {
        console.error(`${log}quote_edge_lines`, edgeError.message)
        return { ok: false, message: 'Nem sikerült menteni az élzáró bontást.' }
      }
    }

    const services = serviceLinesFromPricing(lineRow.id, material)
    if (services.length > 0) {
      const { error: serviceError } = await supabase
        .from('quote_service_lines')
        .insert(services)
      if (serviceError) {
        console.error(`${log}quote_service_lines`, serviceError.message)
        return {
          ok: false,
          message: 'Nem sikerült menteni a megmunkálás tételeket.'
        }
      }
    }
  }

  const feeTotals = await recalculateQuoteFeeTotals(supabase, tenantId, quoteId)
  if (!feeTotals.ok) {
    return { ok: false, message: feeTotals.message }
  }

  return { ok: true }
}
