'use server'

import { revalidatePath } from 'next/cache'

import { getPartnerSession } from '@/lib/auth/partner-session'
import {
  PARTNER_OPTI_PATH,
  PARTNER_ORDERS_PATH,
  PARTNER_QUOTES_PATH
} from '@/lib/auth/surface'

function revalidatePartnerPaths(...cleanPaths: string[]) {
  for (const p of cleanPaths) {
    revalidatePath(p)
    if (!p.startsWith('/partner')) {
      revalidatePath(`/partner${p}`)
    }
  }
}
import type { OptiPanelDraft } from '@/lib/opti/panel-draft'
import type { QuoteResult } from '@/lib/opti/quote-calculations'
import type { OptiSheetMaterialOption } from '@/lib/opti/queries'
import {
  assertQuoteReady,
  edgeLinesFromPricing,
  materialLineFromPricing,
  panelsToInserts,
  quotePricingMode
} from '@/lib/quotes/snapshot'
import { allocatePartnerQuoteNumber } from '@/lib/quotes/partner-quote-number'
import { normalizeProjectName } from '@/lib/quotes/project-name'
import { createClient } from '@/lib/supabase/server'

export type SavePartnerOptiQuoteInput = {
  quoteId?: string | null
  projectName?: string | null
  panels: OptiPanelDraft[]
  quote: QuoteResult
  sheetMaterials: OptiSheetMaterialOption[]
}

export type SavePartnerOptiQuoteResult =
  | { ok: true; id: string; quoteNumber: string }
  | { ok: false; message: string }

export async function savePartnerOptiQuote(
  input: SavePartnerOptiQuoteInput
): Promise<SavePartnerOptiQuoteResult> {
  const session = await getPartnerSession()
  if (!session) {
    return { ok: false, message: 'Nincs bejelentkezve.' }
  }

  const tenantId = session.selectedTenantId
  if (!tenantId) {
    return {
      ok: false,
      message: 'Nincs kapcsolt cég. Válassz céget a Beállításokban.'
    }
  }

  const supabase = await createClient()
  if (!supabase) {
    return { ok: false, message: 'Az adatbázis kapcsolat nem elérhető.' }
  }

  const readyError = assertQuoteReady({
    panels: input.panels,
    quote: input.quote,
    sheetMaterials: input.sheetMaterials
  })
  if (readyError) return { ok: false, message: readyError }

  const projectNormalized = normalizeProjectName(input.projectName)
  if ('error' in projectNormalized) {
    return { ok: false, message: projectNormalized.error }
  }
  const projectName = projectNormalized.value

  const { data: customerId, error: customerError } = await supabase.rpc(
    'ensure_partner_customer',
    { p_tenant_id: tenantId }
  )

  if (customerError || !customerId || typeof customerId !== 'string') {
    console.error('ensure_partner_customer', customerError?.message)
    const msg = customerError?.message ?? ''
    if (msg.includes('Nincs kapcsolt') || msg.includes('selected')) {
      return {
        ok: false,
        message: 'Nincs kapcsolt cég. Válassz céget a Beállításokban.'
      }
    }
    if (msg.includes('partner_orders') || msg.includes('nem fogad')) {
      return {
        ok: false,
        message: 'Ez a cég jelenleg nem fogad online partner rendelést.'
      }
    }
    return { ok: false, message: 'Nem sikerült létrehozni az ügyfél rekordot.' }
  }

  const isEdit = Boolean(input.quoteId)
  let quoteId = input.quoteId ?? null
  let quoteNumber: string

  if (isEdit && quoteId) {
    const { data: existing, error: existingError } = await supabase
      .from('quotes')
      .select('id, quote_number, status, source, portal_submitted_at')
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .eq('partner_profile_id', session.id)
      .eq('source', 'portal')
      .is('deleted_at', null)
      .maybeSingle()

    if (existingError || !existing) {
      return { ok: false, message: 'Az ajánlat nem található.' }
    }
    if (existing.status !== 'draft') {
      return {
        ok: false,
        message: 'Csak piszkozat ajánlat szerkeszthető.'
      }
    }
    if (existing.portal_submitted_at) {
      return {
        ok: false,
        message: 'A beküldött ajánlatot már nem szerkesztheted.'
      }
    }
    quoteNumber = existing.quote_number

    const { error: delPanels } = await supabase
      .from('quote_panels')
      .delete()
      .eq('quote_id', quoteId)
    const { error: delLines } = await supabase
      .from('quote_material_lines')
      .delete()
      .eq('quote_id', quoteId)

    if (delPanels || delLines) {
      return { ok: false, message: 'Nem sikerült frissíteni a tételeket.' }
    }

    const { error: updateError } = await supabase
      .from('quotes')
      .update({
        customer_id: customerId,
        project_name: projectName,
        pricing_mode: quotePricingMode(input.quote),
        currency: input.quote.currency || 'HUF',
        total_net: Math.round(input.quote.grand_total_net * 100) / 100,
        total_vat: Math.round(input.quote.grand_total_vat * 100) / 100,
        total_gross: Math.round(input.quote.grand_total_gross * 100) / 100,
        updated_at: new Date().toISOString()
      })
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .eq('partner_profile_id', session.id)

    if (updateError) {
      console.error('partner quotes update', updateError.message)
      return { ok: false, message: 'Nem sikerült frissíteni az ajánlatot.' }
    }
  } else {
    // Prefer RPC if 20260401 applied; otherwise allocate via service role.
    let quoteNumberResolved: string | null = null
    const { data: generated, error: genError } = await supabase.rpc(
      'generate_quote_number',
      { p_tenant_id: tenantId }
    )

    if (!genError && typeof generated === 'string' && generated.length > 0) {
      quoteNumberResolved = generated
    } else {
      if (genError) {
        console.error('generate_quote_number', genError.message)
      }
      const allocated = await allocatePartnerQuoteNumber(tenantId)
      if (!allocated.ok) {
        return { ok: false, message: allocated.message }
      }
      quoteNumberResolved = allocated.quoteNumber
    }
    quoteNumber = quoteNumberResolved

    const { data: inserted, error: insertError } = await supabase
      .from('quotes')
      .insert({
        tenant_id: tenantId,
        customer_id: customerId,
        quote_number: quoteNumber,
        status: 'draft',
        source: 'portal',
        partner_profile_id: session.id,
        portal_submitted_at: null,
        project_name: projectName,
        pricing_mode: quotePricingMode(input.quote),
        currency: input.quote.currency || 'HUF',
        total_net: Math.round(input.quote.grand_total_net * 100) / 100,
        total_vat: Math.round(input.quote.grand_total_vat * 100) / 100,
        total_gross: Math.round(input.quote.grand_total_gross * 100) / 100,
        created_by: session.id
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error('partner quotes insert', insertError?.message)
      return { ok: false, message: 'Nem sikerült menteni az ajánlatot.' }
    }
    quoteId = inserted.id
  }

  if (!quoteId) {
    return { ok: false, message: 'Nem sikerült menteni az ajánlatot.' }
  }

  const panelRows = panelsToInserts(quoteId, input.panels)
  const { error: panelsError } = await supabase
    .from('quote_panels')
    .insert(panelRows)

  if (panelsError) {
    console.error('partner quote_panels', panelsError.message)
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
      console.error('partner quote_material_lines', lineError?.message)
      return { ok: false, message: 'Nem sikerült menteni az árazást.' }
    }

    const edges = edgeLinesFromPricing(lineRow.id, material)
    if (edges.length > 0) {
      const { error: edgeError } = await supabase
        .from('quote_edge_lines')
        .insert(edges)
      if (edgeError) {
        console.error('partner quote_edge_lines', edgeError.message)
        return { ok: false, message: 'Nem sikerült menteni az élzáró bontást.' }
      }
    }
  }

  revalidatePartnerPaths(
    PARTNER_OPTI_PATH,
    PARTNER_QUOTES_PATH,
    PARTNER_ORDERS_PATH
  )

  return { ok: true, id: quoteId, quoteNumber }
}

export type SubmitPartnerQuoteResult =
  | { ok: true; id: string; quoteNumber: string }
  | { ok: false; message: string }

export type SoftDeletePartnerQuoteResult =
  | { ok: true; id: string }
  | { ok: false; message: string }

/** Beküldés a kapcsolt cégnek — lock (portal_submitted_at). */
export async function submitPartnerQuote(
  quoteId: string
): Promise<SubmitPartnerQuoteResult> {
  try {
    const session = await getPartnerSession()
    if (!session) {
      return { ok: false, message: 'Nincs bejelentkezve.' }
    }

    const tenantId = session.selectedTenantId
    if (!tenantId) {
      return {
        ok: false,
        message: 'Nincs kapcsolt cég. Válassz céget a Beállításokban.'
      }
    }

    const supabase = await createClient()
    if (!supabase) {
      return { ok: false, message: 'Az adatbázis kapcsolat nem elérhető.' }
    }

    const { data: existing, error: loadError } = await supabase
      .from('quotes')
      .select('id, quote_number, status, portal_submitted_at, tenant_id')
      .eq('id', quoteId)
      .eq('partner_profile_id', session.id)
      .eq('source', 'portal')
      .is('deleted_at', null)
      .maybeSingle()

    if (loadError || !existing) {
      return { ok: false, message: 'Az ajánlat nem található.' }
    }

    if (existing.tenant_id !== tenantId) {
      return {
        ok: false,
        message: 'Ez az ajánlat másik céghez tartozik. Válts kapcsolt céget.'
      }
    }

    if (existing.status !== 'draft') {
      return { ok: false, message: 'Csak piszkozat ajánlat küldhető be.' }
    }

    if (existing.portal_submitted_at) {
      return { ok: false, message: 'Ez az ajánlat már be van küldve.' }
    }

    const now = new Date().toISOString()
    const { data: updated, error: updateError } = await supabase
      .from('quotes')
      .update({
        portal_submitted_at: now,
        updated_at: now
      })
      .eq('id', quoteId)
      .eq('partner_profile_id', session.id)
      .eq('source', 'portal')
      .is('portal_submitted_at', null)
      .is('deleted_at', null)
      .select('id, quote_number')
      .maybeSingle()

    if (updateError || !updated) {
      console.error('submitPartnerQuote', updateError?.message)
      return { ok: false, message: 'Nem sikerült beküldeni az ajánlatot.' }
    }

    revalidatePartnerPaths(
      PARTNER_QUOTES_PATH,
      PARTNER_ORDERS_PATH,
      PARTNER_OPTI_PATH,
      `${PARTNER_QUOTES_PATH}/${quoteId}`
    )

    return {
      ok: true,
      id: updated.id,
      quoteNumber: updated.quote_number
    }
  } catch (err) {
    console.error('submitPartnerQuote', err)
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült beküldeni az ajánlatot.'
    }
  }
}

export type UpdatePartnerQuoteCommentResult =
  | { ok: true }
  | { ok: false; message: string }

export async function updatePartnerQuoteComment(
  quoteId: string,
  comment: string
): Promise<UpdatePartnerQuoteCommentResult> {
  try {
    const session = await getPartnerSession()
    if (!session) {
      return { ok: false, message: 'Nincs bejelentkezve.' }
    }

    const supabase = await createClient()
    if (!supabase) {
      return { ok: false, message: 'Az adatbázis kapcsolat nem elérhető.' }
    }

    const trimmed = comment.trim()
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('quotes')
      .update({
        comment: trimmed === '' ? null : trimmed,
        updated_at: now
      })
      .eq('id', quoteId)
      .eq('partner_profile_id', session.id)
      .eq('source', 'portal')
      .is('portal_submitted_at', null)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('updatePartnerQuoteComment', error.message)
      return { ok: false, message: 'Nem sikerült menteni a megjegyzést.' }
    }
    if (!data) {
      return {
        ok: false,
        message: 'Az ajánlat nem található, vagy már be van küldve.'
      }
    }

    revalidatePartnerPaths(
      PARTNER_QUOTES_PATH,
      `${PARTNER_QUOTES_PATH}/${quoteId}`,
      `${PARTNER_ORDERS_PATH}/${quoteId}`
    )
    return { ok: true }
  } catch (err) {
    console.error('updatePartnerQuoteComment', err)
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült menteni a megjegyzést.'
    }
  }
}

export type UpdatePartnerQuoteProjectNameResult =
  | { ok: true }
  | { ok: false; message: string }

export async function updatePartnerQuoteProjectName(
  quoteId: string,
  projectName: string
): Promise<UpdatePartnerQuoteProjectNameResult> {
  try {
    const session = await getPartnerSession()
    if (!session) {
      return { ok: false, message: 'Nincs bejelentkezve.' }
    }

    const supabase = await createClient()
    if (!supabase) {
      return { ok: false, message: 'Az adatbázis kapcsolat nem elérhető.' }
    }

    const normalized = normalizeProjectName(projectName)
    if ('error' in normalized) {
      return { ok: false, message: normalized.error }
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('quotes')
      .update({
        project_name: normalized.value,
        updated_at: now
      })
      .eq('id', quoteId)
      .eq('partner_profile_id', session.id)
      .eq('source', 'portal')
      .is('portal_submitted_at', null)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('updatePartnerQuoteProjectName', error.message)
      return { ok: false, message: 'Nem sikerült menteni a projekt nevét.' }
    }
    if (!data) {
      return {
        ok: false,
        message: 'Az ajánlat nem található, vagy már be van küldve.'
      }
    }

    revalidatePartnerPaths(
      PARTNER_QUOTES_PATH,
      `${PARTNER_QUOTES_PATH}/${quoteId}`,
      `${PARTNER_ORDERS_PATH}/${quoteId}`
    )
    return { ok: true }
  } catch (err) {
    console.error('updatePartnerQuoteProjectName', err)
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült menteni a projekt nevét.'
    }
  }
}

/** Elküldetlen portal draft törlése (hard delete — RLS WITH CHECK nem engedi a soft delete-et). */
export async function softDeletePartnerQuote(
  quoteId: string
): Promise<SoftDeletePartnerQuoteResult> {
  try {
    const session = await getPartnerSession()
    if (!session) {
      return { ok: false, message: 'Nincs bejelentkezve.' }
    }

    const supabase = await createClient()
    if (!supabase) {
      return { ok: false, message: 'Az adatbázis kapcsolat nem elérhető.' }
    }

    const { data, error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId)
      .eq('partner_profile_id', session.id)
      .eq('source', 'portal')
      .is('portal_submitted_at', null)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('softDeletePartnerQuote', error.message)
      return { ok: false, message: 'Nem sikerült törölni az ajánlatot.' }
    }
    if (!data) {
      return {
        ok: false,
        message: 'Az ajánlat nem található, vagy már be van küldve.'
      }
    }

    revalidatePartnerPaths(PARTNER_QUOTES_PATH, PARTNER_OPTI_PATH)
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('softDeletePartnerQuote', err)
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült törölni az ajánlatot.'
    }
  }
}

