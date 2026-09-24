'use server'

import { revalidatePath } from 'next/cache'

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
import { recalculateQuoteFeeTotals } from '@/lib/quotes/fee-totals'
import {
  PAYMENT_TOLERANCE_GROSS,
  quoteRemainingGross
} from '@/lib/quotes/payment-labels'
import { normalizeProjectName } from '@/lib/quotes/project-name'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type SaveOptiQuoteCustomer = {
  customerId: string | null
  name: string
  email: string
  mobile: string
  billingName: string
  billingCountry: string
  billingCity: string
  billingPostalCode: string
  billingStreet: string
  billingHouseNumber: string
  billingTaxNumber: string
}

export type SaveOptiQuoteInput = {
  quoteId?: string | null
  customer: SaveOptiQuoteCustomer
  projectName?: string | null
  panels: OptiPanelDraft[]
  quote: QuoteResult
  sheetMaterials: OptiSheetMaterialOption[]
}

export type SaveOptiQuoteResult =
  | { ok: true; id: string; quoteNumber: string }
  | { ok: false; message: string }

const LIST_PATH = '/ajanlatok'

function emptyToNull(value: string): string | null {
  const t = value.trim()
  return t === '' ? null : t
}

async function resolveCustomerId(
  ctx: Extract<Awaited<ReturnType<typeof requireWritableTenant>>, { ok: true }>,
  customer: SaveOptiQuoteCustomer
): Promise<{ id: string } | { error: string }> {
  const tenantId = ctx.user.tenantId!
  const name = customer.name.trim()
  if (!name) return { error: 'A megrendelő neve kötelező.' }

  if (customer.customerId) {
    const { data, error } = await ctx.supabase
      .from('customers')
      .select('id')
      .eq('id', customer.customerId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) {
      return { error: 'A kiválasztott ügyfél nem található.' }
    }
    return { id: data.id }
  }

  const row = {
    tenant_id: tenantId,
    name,
    email: emptyToNull(customer.email),
    mobile: emptyToNull(customer.mobile),
    billing_name: emptyToNull(customer.billingName),
    billing_country: customer.billingCountry.trim() || 'Magyarország',
    billing_city: emptyToNull(customer.billingCity),
    billing_postal_code: emptyToNull(customer.billingPostalCode),
    billing_street: emptyToNull(customer.billingStreet),
    billing_house_number: emptyToNull(customer.billingHouseNumber),
    billing_tax_number: emptyToNull(customer.billingTaxNumber)
  }

  const { data, error } = await ctx.supabase
    .from('customers')
    .insert(row)
    .select('id')
    .single()

  if (error || !data) {
    if (error?.message?.includes('customers_tenant_name_alive')) {
      return {
        error:
          'Már van ilyen nevű ügyfél — válaszd ki a listából, vagy adj más nevet.'
      }
    }
    return { error: 'Nem sikerült létrehozni az ügyfelet.' }
  }

  return { id: data.id }
}

export async function saveOptiQuote(
  input: SaveOptiQuoteInput
): Promise<SaveOptiQuoteResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

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

  const customerResult = await resolveCustomerId(ctx, input.customer)
  if ('error' in customerResult) {
    return { ok: false, message: customerResult.error }
  }

  const tenantId = ctx.user.tenantId!
  const isEdit = Boolean(input.quoteId)
  let quoteId = input.quoteId ?? null
  let quoteNumber: string

  if (isEdit && quoteId) {
    const { data: existing, error: existingError } = await ctx.supabase
      .from('quotes')
      .select('id, quote_number, status')
      .eq('id', quoteId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .maybeSingle()

    if (existingError || !existing) {
      return { ok: false, message: 'Az árajánlat nem található.' }
    }
    if (existing.status !== 'draft' && existing.status !== 'ordered') {
      return {
        ok: false,
        message:
          'Csak piszkozat vagy megrendelés státuszú dokumentum szerkeszthető Optiból.'
      }
    }
    quoteNumber = existing.quote_number

    const { error: delPanels } = await ctx.supabase
      .from('quote_panels')
      .delete()
      .eq('quote_id', quoteId)
    const { error: delLines } = await ctx.supabase
      .from('quote_material_lines')
      .delete()
      .eq('quote_id', quoteId)

    if (delPanels || delLines) {
      return { ok: false, message: 'Nem sikerült frissíteni a tételeket.' }
    }

    const { error: updateError } = await ctx.supabase
      .from('quotes')
      .update({
        customer_id: customerResult.id,
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

    if (updateError) {
      return { ok: false, message: 'Nem sikerült frissíteni az árajánlatot.' }
    }
  } else {
    const { data: generated, error: genError } = await ctx.supabase.rpc(
      'generate_quote_number',
      { p_tenant_id: tenantId }
    )

    if (genError || !generated || typeof generated !== 'string') {
      console.error('generate_quote_number', genError?.message)
      return { ok: false, message: 'Nem sikerült árajánlat-számot generálni.' }
    }
    quoteNumber = generated

    const { data: inserted, error: insertError } = await ctx.supabase
      .from('quotes')
      .insert({
        tenant_id: tenantId,
        customer_id: customerResult.id,
        quote_number: quoteNumber,
        status: 'draft',
        source: 'opti',
        project_name: projectName,
        pricing_mode: quotePricingMode(input.quote),
        currency: input.quote.currency || 'HUF',
        total_net: Math.round(input.quote.grand_total_net * 100) / 100,
        total_vat: Math.round(input.quote.grand_total_vat * 100) / 100,
        total_gross: Math.round(input.quote.grand_total_gross * 100) / 100,
        created_by: ctx.user.id
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      console.error('quotes insert', insertError?.message)
      return { ok: false, message: 'Nem sikerült menteni az árajánlatot.' }
    }
    quoteId = inserted.id
  }

  if (!quoteId) {
    return { ok: false, message: 'Nem sikerült menteni az árajánlatot.' }
  }

  const panelRows = panelsToInserts(quoteId, input.panels)
  const { error: panelsError } = await ctx.supabase
    .from('quote_panels')
    .insert(panelRows)

  if (panelsError) {
    console.error('quote_panels', panelsError.message)
    return { ok: false, message: 'Nem sikerült menteni a paneleket.' }
  }

  for (const material of input.quote.materials) {
    const sheet = input.sheetMaterials.find((m) => m.id === material.material_id)
    const line = materialLineFromPricing(quoteId, material, sheet)
    const { data: lineRow, error: lineError } = await ctx.supabase
      .from('quote_material_lines')
      .insert(line)
      .select('id')
      .single()

    if (lineError || !lineRow) {
      console.error('quote_material_lines', lineError?.message)
      return { ok: false, message: 'Nem sikerült menteni az árazást.' }
    }

    const edges = edgeLinesFromPricing(lineRow.id, material)
    if (edges.length > 0) {
      const { error: edgeError } = await ctx.supabase
        .from('quote_edge_lines')
        .insert(edges)
      if (edgeError) {
        console.error('quote_edge_lines', edgeError.message)
        return { ok: false, message: 'Nem sikerült menteni az élzáró bontást.' }
      }
    }
  }

  const feeTotals = await recalculateQuoteFeeTotals(
    ctx.supabase,
    tenantId,
    quoteId
  )
  if (!feeTotals.ok) {
    return { ok: false, message: feeTotals.message }
  }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${quoteId}`)
  revalidatePath('/opti')
  revalidatePath('/ugyfelek')

  if (ctx.user.tenantId) {
    const { markOnboardingFlag } = await import(
      '@/lib/platform/onboarding-flags'
    )
    await markOnboardingFlag(ctx.user.tenantId, { has_quote: true })
  }

  return { ok: true, id: quoteId, quoteNumber }
}

export type SoftDeleteQuoteResult =
  | { ok: true; id: string }
  | { ok: false; message: string }

export async function softDeleteQuote(
  id: string
): Promise<SoftDeleteQuoteResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase
    .from('quotes')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id, quote_number')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült törölni az árajánlatot.' }
  }
  if (!data) {
    return { ok: false, message: 'Az árajánlat nem található.' }
  }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${id}`)
  return { ok: true, id: data.id }
}

export type UpdateQuoteCommentResult =
  | { ok: true }
  | { ok: false; message: string }

export async function updateQuoteComment(
  quoteId: string,
  comment: string
): Promise<UpdateQuoteCommentResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const trimmed = comment.trim()
  const { data, error } = await ctx.supabase
    .from('quotes')
    .update({
      comment: trimmed === '' ? null : trimmed,
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült menteni a megjegyzést.' }
  }
  if (!data) {
    return { ok: false, message: 'Az árajánlat nem található.' }
  }

  revalidatePath(`${LIST_PATH}/${quoteId}`)
  return { ok: true }
}

export type UpdateQuoteProjectNameResult =
  | { ok: true }
  | { ok: false; message: string }

export async function updateQuoteProjectName(
  quoteId: string,
  projectName: string
): Promise<UpdateQuoteProjectNameResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const normalized = normalizeProjectName(projectName)
  if ('error' in normalized) {
    return { ok: false, message: normalized.error }
  }

  const { data, error } = await ctx.supabase
    .from('quotes')
    .update({
      project_name: normalized.value,
      updated_at: new Date().toISOString()
    })
    .eq('id', quoteId)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error) {
    return { ok: false, message: 'Nem sikerült menteni a projekt nevét.' }
  }
  if (!data) {
    return { ok: false, message: 'Az árajánlat nem található.' }
  }

  revalidatePath(LIST_PATH)
  revalidatePath('/megrendelesek')
  revalidatePath(`${LIST_PATH}/${quoteId}`)
  return { ok: true }
}

export type ConvertQuoteToOrderResult =
  | { ok: true; id: string; orderNumber: string; paymentStatus: string }
  | { ok: false; message: string }

export type ConvertQuoteToOrderPayment = {
  amount: number
  paymentMethodId: string | null
  comment: string
}

/** Draft árajánlat → megrendelés (+ opcionális előleg). */
export async function convertQuoteToOrder(
  quoteId: string,
  payment?: ConvertQuoteToOrderPayment
): Promise<ConvertQuoteToOrderResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const amount = payment?.amount ?? 0
  const paymentMethodId = payment?.paymentMethodId ?? null
  const comment = payment?.comment?.trim() ?? ''

  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: 'Érvénytelen befizetett összeg.' }
  }

  if (amount > 0 && !paymentMethodId) {
    return {
      ok: false,
      message: 'Válassz fizetési módot az előleghez.'
    }
  }

  const { data, error } = await ctx.supabase.rpc('convert_quote_to_order', {
    p_quote_id: quoteId,
    p_tenant_id: tenantId,
    p_amount: amount,
    p_payment_method_id: amount > 0 ? paymentMethodId : null,
    p_payment_comment: comment === '' ? null : comment
  })

  if (error) {
    console.error('convert_quote_to_order', error.message)
    const msg = error.message || ''
    if (msg.includes('quote not draft') || msg.includes('order already')) {
      return {
        ok: false,
        message: 'Az árajánlat már nem piszkozat, vagy közben megváltozott.'
      }
    }
    if (msg.includes('amount exceeds')) {
      return {
        ok: false,
        message: 'A befizetett összeg nem lehet nagyobb, mint a végösszeg.'
      }
    }
    if (msg.includes('payment method')) {
      return {
        ok: false,
        message:
          'A választott fizetési mód nem elérhető. Ellenőrizd a törzsadatot.'
      }
    }
    if (msg.includes('quote not found')) {
      return { ok: false, message: 'Az árajánlat nem található.' }
    }
    return { ok: false, message: 'Nem sikerült megrendeléssé alakítani.' }
  }

  const payload = data as {
    order_number?: string
    payment_status?: string
  } | null

  if (!payload?.order_number) {
    return { ok: false, message: 'Nem sikerült megrendeléssé alakítani.' }
  }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${quoteId}`)
  revalidatePath('/megrendelesek')
  revalidatePath('/opti')

  if (ctx.user.tenantId) {
    const { markOnboardingFlag } = await import(
      '@/lib/platform/onboarding-flags'
    )
    await markOnboardingFlag(ctx.user.tenantId, { has_order: true })
  }

  return {
    ok: true,
    id: quoteId,
    orderNumber: payload.order_number,
    paymentStatus: payload.payment_status ?? 'not_paid'
  }
}

export type AddQuotePaymentResult =
  | { ok: true }
  | { ok: false; message: string }

export async function addQuotePayment(input: {
  quoteId: string
  amount: number
  paymentMethodId: string
  comment: string
}): Promise<AddQuotePaymentResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const amount = input.amount

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: 'Adj meg pozitív összeget.' }
  }

  if (!input.paymentMethodId) {
    return { ok: false, message: 'Válassz fizetési módot.' }
  }

  const { data: quote, error: quoteError } = await ctx.supabase
    .from('quotes')
    .select('id, status, order_number, total_gross, final_total_gross')
    .eq('id', input.quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (quoteError || !quote) {
    return { ok: false, message: 'A megrendelés nem található.' }
  }

  if (quote.status === 'draft' || quote.status === 'cancelled') {
    return {
      ok: false,
      message: 'Ehhez a státuszhoz nem rögzíthető befizetés.'
    }
  }

  if (!quote.order_number) {
    return { ok: false, message: 'Nincs megrendelésszám.' }
  }

  const { data: method, error: methodError } = await ctx.supabase
    .from('payment_methods')
    .select('id, name')
    .eq('id', input.paymentMethodId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (methodError || !method) {
    return {
      ok: false,
      message: 'A választott fizetési mód nem elérhető.'
    }
  }

  const { data: payments } = await ctx.supabase
    .from('quote_payments')
    .select('amount')
    .eq('quote_id', input.quoteId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  const totalPaid = (payments ?? []).reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0
  )
  const totalGross =
    Number(quote.final_total_gross ?? quote.total_gross) || 0
  const remaining = quoteRemainingGross(totalGross, totalPaid)

  if (amount > remaining + PAYMENT_TOLERANCE_GROSS) {
    return {
      ok: false,
      message: `Az összeg nem lehet nagyobb, mint a hátralék (${remaining.toLocaleString('hu-HU')} Ft).`
    }
  }

  const userId = ctx.user.id
  if (!userId) {
    return { ok: false, message: 'Nincs bejelentkezett felhasználó.' }
  }

  const comment = input.comment.trim()
  const { error: insertError } = await ctx.supabase.from('quote_payments').insert({
    tenant_id: tenantId,
    quote_id: input.quoteId,
    amount: Math.round(amount * 100) / 100,
    payment_method_id: method.id,
    payment_method_name: method.name,
    comment: comment === '' ? null : comment,
    payment_date: new Date().toISOString(),
    created_by: userId
  })

  if (insertError) {
    console.error('addQuotePayment', insertError.message)
    return { ok: false, message: 'Nem sikerült rögzíteni a befizetést.' }
  }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${input.quoteId}`)
  revalidatePath('/megrendelesek')
  return { ok: true }
}

export type UpdateQuoteBillingInput = {
  quoteId: string
  billing: {
    billingName: string
    billingCountry: string
    billingCity: string | null
    billingPostalCode: string | null
    billingStreet: string | null
    billingHouseNumber: string | null
    billingTaxNumber: string | null
  }
}

export type UpdateQuoteBillingResult =
  | { ok: true }
  | { ok: false; message: string }

export async function updateQuoteBillingAction(
  input: UpdateQuoteBillingInput
): Promise<UpdateQuoteBillingResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const name = input.billing.billingName.trim()
  if (!name) {
    return { ok: false, message: 'A számlázási név kötelező.' }
  }

  const { data: quote, error: quoteErr } = await ctx.supabase
    .from('quotes')
    .select('id, status, order_number, deleted_at')
    .eq('id', input.quoteId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (quoteErr || !quote || quote.deleted_at) {
    return { ok: false, message: 'Az ajánlat nem található.' }
  }
  if (quote.status === 'cancelled') {
    return { ok: false, message: 'Törölt ajánlaton nem módosítható a számlázás.' }
  }
  if (!quote.order_number) {
    return {
      ok: false,
      message: 'Számlázási adatot megrendelés után lehet menteni.'
    }
  }

  const { data: invoices } = await ctx.supabase
    .from('invoices')
    .select('id, invoice_type, is_storno_of_invoice_id')
    .eq('tenant_id', tenantId)
    .eq('related_source_type', 'opti_order')
    .eq('related_source_id', input.quoteId)
    .is('deleted_at', null)

  const rows = invoices ?? []
  const stornoOf = new Set(
    rows
      .filter((r) => r.invoice_type === 'sztorno' && r.is_storno_of_invoice_id)
      .map((r) => r.is_storno_of_invoice_id as string)
  )
  const hasActiveFinal = rows.some(
    (r) =>
      r.invoice_type === 'szamla' &&
      !r.is_storno_of_invoice_id &&
      !stornoOf.has(r.id)
  )
  if (hasActiveFinal) {
    return {
      ok: false,
      message:
        'Aktív számla mellett a számlázási adat nem módosítható. Előbb sztornózd a számlát.'
    }
  }

  const b = input.billing
  const { error } = await ctx.supabase
    .from('quotes')
    .update({
      billing_name_snapshot: name,
      billing_country_snapshot: b.billingCountry.trim() || 'Magyarország',
      billing_city_snapshot: b.billingCity?.trim() || null,
      billing_postal_code_snapshot: b.billingPostalCode?.trim() || null,
      billing_street_snapshot: b.billingStreet?.trim() || null,
      billing_house_number_snapshot: b.billingHouseNumber?.trim() || null,
      billing_tax_number_snapshot: b.billingTaxNumber?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.quoteId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('updateQuoteBillingAction', error.message)
    return { ok: false, message: 'Nem sikerült menteni a számlázási adatokat.' }
  }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${input.quoteId}`)
  revalidatePath('/szamlak')
  return { ok: true }
}
