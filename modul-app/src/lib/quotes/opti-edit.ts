import type { SupabaseClient } from '@supabase/supabase-js'

import type { OptiCustomerOption } from '@/lib/customers/queries'
import {
  createPanelDraft,
  normalizePanthelyOldal,
  type OptiPanelDraft
} from '@/lib/opti/panel-draft'
import {
  formatEdgeMaterialLabel,
  type OptiEdgeMaterialOption,
  type OptiSheetMaterialOption
} from '@/lib/opti/queries'
import {
  isOptiLockedByPortalSubmit,
  isPortalSubmittedQuote
} from '@/lib/quotes/portal-opti-edit'
import {
  isQuoteEditableInOpti,
  type QuoteStatus
} from '@/lib/quotes/queries'

export type QuoteForOptiEdit = {
  id: string
  quote_number: string
  status: QuoteStatus
  editable: boolean
  project_name: string | null
  customer: OptiCustomerOption | null
  panels: OptiPanelDraft[]
  warnings: string[]
}

type EdgeJoin = {
  id: string
  type: string
  decor: string
  width_mm: number
  thickness_mm: number
} | null

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function edgeLabel(
  edge: EdgeJoin,
  edgeMaterials: OptiEdgeMaterialOption[]
): string {
  if (!edge) return ''
  const live = edgeMaterials.find((e) => e.id === edge.id)
  if (live) return formatEdgeMaterialLabel(live)
  return formatEdgeMaterialLabel(edge)
}

/** Lean quote load for Opti edit — panels + customer, no nesting. */
export async function getQuoteForOptiEdit(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string,
  sheetMaterials: OptiSheetMaterialOption[],
  edgeMaterials: OptiEdgeMaterialOption[],
  options?: { partnerMode?: boolean }
): Promise<QuoteForOptiEdit | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select(
      `
      id,
      quote_number,
      status,
      source,
      portal_submitted_at,
      partner_profile_id,
      project_name,
      customers (
        id,
        name,
        email,
        mobile,
        billing_name,
        billing_country,
        billing_city,
        billing_postal_code,
        billing_street,
        billing_house_number,
        billing_tax_number
      ),
      quote_panels (
        id,
        sheet_material_id,
        grain_mm,
        cross_mm,
        quantity,
        label,
        sort_index,
        duplungolas,
        szogvagas,
        panthelyfuras_quantity,
        panthelyfuras_oldal,
        edge_a_id,
        edge_b_id,
        edge_c_id,
        edge_d_id,
        sheet_materials ( name ),
        edge_a:edge_materials!quote_panels_edge_a_id_fkey (
          id, type, decor, width_mm, thickness_mm
        ),
        edge_b:edge_materials!quote_panels_edge_b_id_fkey (
          id, type, decor, width_mm, thickness_mm
        ),
        edge_c:edge_materials!quote_panels_edge_c_id_fkey (
          id, type, decor, width_mm, thickness_mm
        ),
        edge_d:edge_materials!quote_panels_edge_d_id_fkey (
          id, type, decor, width_mm, thickness_mm
        )
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getQuoteForOptiEdit', error.message)
    throw new Error('Nem sikerült betölteni az árajánlatot Optiba.')
  }
  if (!data) return null

  if (options?.partnerMode) {
    if (data.source !== 'portal' || data.partner_profile_id == null) {
      return null
    }
  } else if (data.source === 'portal' && data.portal_submitted_at == null) {
    // Staff must not open unsubmitted partner drafts via Opti
    return null
  }

  const status = data.status as QuoteStatus
  const partnerMode = Boolean(options?.partnerMode)
  const submitted = isPortalSubmittedQuote({
    source: data.source,
    portalSubmittedAt: data.portal_submitted_at
  })
  const lockedBySubmit = isOptiLockedByPortalSubmit({
    partnerMode,
    source: data.source,
    portalSubmittedAt: data.portal_submitted_at
  })
  const editable = isQuoteEditableInOpti(status) && !lockedBySubmit
  const warnings: string[] = []

  if (lockedBySubmit) {
    warnings.push('A beküldött ajánlatot már nem szerkesztheted.')
  } else if (!isQuoteEditableInOpti(status)) {
    warnings.push(
      'Ez a dokumentum ebben a státuszban nem szerkeszthető Optiból (csak piszkozat vagy megrendelés).'
    )
  } else if (submitted && !partnerMode) {
    warnings.push(
      'Online partner rendelés — a módosítás a cég oldalán történik. A partner továbbra sem szerkesztheti.'
    )
  }

  if (!editable) {
    return {
      id: data.id,
      quote_number: data.quote_number,
      status,
      editable: false,
      project_name: (data.project_name as string | null) ?? null,
      customer: null,
      panels: [],
      warnings
    }
  }

  const customerRow = one(
    data.customers as OptiCustomerOption | OptiCustomerOption[] | null
  )
  const customer: OptiCustomerOption | null = customerRow
    ? {
        ...customerRow,
        billing_country: customerRow.billing_country || 'Magyarország'
      }
    : null

  const panelRows = (
    (data.quote_panels ?? []) as Array<{
      id: string
      sheet_material_id: string
      grain_mm: number
      cross_mm: number
      quantity: number
      label: string | null
      sort_index: number
      duplungolas?: boolean | null
      szogvagas?: boolean | null
      panthelyfuras_quantity?: number | null
      panthelyfuras_oldal?: string | null
      edge_a_id: string | null
      edge_b_id: string | null
      edge_c_id: string | null
      edge_d_id: string | null
      sheet_materials: { name: string } | { name: string }[] | null
      edge_a: EdgeJoin | EdgeJoin[]
      edge_b: EdgeJoin | EdgeJoin[]
      edge_c: EdgeJoin | EdgeJoin[]
      edge_d: EdgeJoin | EdgeJoin[]
    }>
  ).slice().sort((a, b) => a.sort_index - b.sort_index)

  const sheetIds = new Set(sheetMaterials.map((m) => m.id))
  const edgeIds = new Set(edgeMaterials.map((e) => e.id))
  const missingSheets = new Set<string>()
  const missingEdges = new Set<string>()

  const panels: OptiPanelDraft[] = panelRows.map((row) => {
    const sheetName =
      sheetMaterials.find((m) => m.id === row.sheet_material_id)?.name ??
      one(row.sheet_materials)?.name ??
      'Ismeretlen anyag'

    if (!sheetIds.has(row.sheet_material_id)) {
      missingSheets.add(sheetName)
    }

    for (const edgeId of [
      row.edge_a_id,
      row.edge_b_id,
      row.edge_c_id,
      row.edge_d_id
    ]) {
      if (edgeId && !edgeIds.has(edgeId)) {
        missingEdges.add(edgeId)
      }
    }

    const edgeA = one(row.edge_a)
    const edgeB = one(row.edge_b)
    const edgeC = one(row.edge_c)
    const edgeD = one(row.edge_d)

    return createPanelDraft({
      sheetMaterialId: row.sheet_material_id,
      sheetMaterialName: sheetName,
      grainMm: Number(row.grain_mm),
      crossMm: Number(row.cross_mm),
      quantity: Number(row.quantity) || 1,
      marking: row.label ?? '',
      edgeAId: row.edge_a_id ?? '',
      edgeBId: row.edge_b_id ?? '',
      edgeCId: row.edge_c_id ?? '',
      edgeDId: row.edge_d_id ?? '',
      edgeALabel: edgeLabel(edgeA, edgeMaterials),
      edgeBLabel: edgeLabel(edgeB, edgeMaterials),
      edgeCLabel: edgeLabel(edgeC, edgeMaterials),
      edgeDLabel: edgeLabel(edgeD, edgeMaterials),
      duplungolas: Boolean(row.duplungolas),
      szogvagas: Boolean(row.szogvagas),
      panthelyfurasQuantity: Number(row.panthelyfuras_quantity) || 0,
      panthelyfurasOldal: normalizePanthelyOldal(row.panthelyfuras_oldal)
    })
  })

  if (missingSheets.size > 0) {
    warnings.push(
      `Hiányzó vagy inaktív táblás anyag: ${Array.from(missingSheets).join(', ')}. Cseréld le a panelt mentés előtt.`
    )
  }
  if (missingEdges.size > 0) {
    warnings.push(
      'Egy vagy több élzáró már nem aktív a törzsadatokban — ellenőrizd a paneleket mentés előtt.'
    )
  }

  if (submitted && !partnerMode) {
    const { data: invRows } = await supabase
      .from('invoices')
      .select('id, invoice_type, is_storno_of_invoice_id, provider_invoice_number')
      .eq('tenant_id', tenantId)
      .eq('related_source_type', 'opti_order')
      .eq('related_source_id', quoteId)
      .is('deleted_at', null)

    const inv = invRows ?? []
    const stornoOf = new Set(
      inv
        .filter((r) => r.invoice_type === 'sztorno' && r.is_storno_of_invoice_id)
        .map((r) => r.is_storno_of_invoice_id as string)
    )
    const hasProforma = inv.some(
      (r) =>
        r.invoice_type === 'dijbekero' &&
        !stornoOf.has(r.id as string) &&
        Boolean(r.provider_invoice_number)
    )
    const hasAdvance = inv.some(
      (r) =>
        r.invoice_type === 'elolegszamla' &&
        !stornoOf.has(r.id as string) &&
        Boolean(r.provider_invoice_number)
    )
    const hasFinal = inv.some(
      (r) =>
        r.invoice_type === 'szamla' &&
        !stornoOf.has(r.id as string) &&
        Boolean(r.provider_invoice_number)
    )
    if (hasAdvance || hasFinal) {
      warnings.push(
        'Van aktív előlegszámla vagy végszámla — mentés előtt sztornózd, különben a mentés nem engedélyezett.'
      )
    } else if (hasProforma) {
      warnings.push(
        'Van élő díjbekérő. Ha az összeg változik, mentéskor meg kell erősítened — utána sztornózd vagy állíts ki újat.'
      )
    }
  }

  return {
    id: data.id,
    quote_number: data.quote_number,
    status,
    editable: true,
    project_name: (data.project_name as string | null) ?? null,
    customer,
    panels,
    warnings
  }
}
