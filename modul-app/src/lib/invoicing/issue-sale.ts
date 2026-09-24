import type { SupabaseClient } from '@supabase/supabase-js'

import { getOrCreateTenantCompany } from '@/lib/company/queries'
import {
  postSzamlazzXml,
  fetchSzamlazzPdf
} from '@/lib/invoicing/szamlazz-agent'
import {
  buildSaleInvoiceXml,
  buildStornoXml
} from '@/lib/invoicing/szamlazz-xml'
import { getOrCreateInvoiceSettings, hasAgentKey } from '@/lib/invoicing/settings'
import {
  issueKindToStoredType,
  type InvoiceIssueKind,
  type InvoicePaymentMethod
} from '@/lib/invoicing/types'
import { getSale, type SaleDetail } from '@/lib/sales/queries'

export type IssueSaleInvoiceInput = {
  saleId: string
  kind: InvoiceIssueKind
  paymentMethod: InvoicePaymentMethod
  dueDate: string
  fulfillmentDate: string
  comment?: string
  language?: string
  sendEmail?: boolean
  markAsPaid?: boolean
  advanceAmount?: number
  proformaAmount?: number
  customerEmail?: string
}

export type IssueResult =
  | { ok: true; invoiceId: string; providerNumber: string }
  | { ok: false; message: string }

function saleHasBilling(detail: SaleDetail): boolean {
  const c = detail.customer
  return Boolean(
    c.billing_name?.trim() ||
      c.billing_city?.trim() ||
      c.billing_street?.trim() ||
      c.name?.trim()
  )
}

function mapSaleLines(detail: SaleDetail) {
  return detail.items.map((i) => {
      const gross = Math.round(i.total_gross)
      const vatPct = Number(i.tax_rate_percent) || 27
      const net = Math.round(gross / (1 + vatPct / 100))
      const vat = gross - net
      const qty = Number(i.quantity) || 1
      return {
        name: i.name_snapshot,
        quantity: qty,
        unit: i.unit_shortform || 'db',
        unitNet: qty > 0 ? net / qty : net,
        vatPercent: vatPct,
        lineNet: net,
        lineVat: vat,
        lineGross: gross
      }
    })
}

function detectPaymentMethod(detail: SaleDetail): InvoicePaymentMethod {
  const name = (detail.payments[0]?.payment_method_name || '').toLowerCase()
  if (name.includes('készpénz') || name.includes('keszpenz') || name.includes('kp')) {
    return 'cash'
  }
  if (name.includes('kártya') || name.includes('kartya') || name.includes('card')) {
    return 'card'
  }
  return 'bank_transfer'
}

export async function issueInvoiceFromSale(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null,
  input: IssueSaleInvoiceInput
): Promise<IssueResult> {
  const settings = await getOrCreateInvoiceSettings(supabase, tenantId)
  if (!hasAgentKey(settings)) {
    return {
      ok: false,
      message:
        'Nincs Számlázz.hu Agent kulcs. Állítsd be: Beállítások → Számlázás.'
    }
  }

  const detail = await getSale(supabase, tenantId, input.saleId)
  if (!detail) return { ok: false, message: 'Az értékesítés nem található.' }
  if (detail.status === 'cancelled') {
    return { ok: false, message: 'Törölt értékesítéshez nem állítható ki számla.' }
  }
  if (!saleHasBilling(detail)) {
    return {
      ok: false,
      message:
        'Hiányoznak a számlázási adatok (név / cím). Töltsd ki az eladáson.'
    }
  }

  const lines = mapSaleLines(detail)
  if (lines.length === 0) {
    return { ok: false, message: 'Nincs tétel az értékesítésen.' }
  }

  if (input.kind === 'advance') {
    const amt = Number(input.advanceAmount) || 0
    if (amt <= 0) {
      return { ok: false, message: 'Az előleg összege kötelező.' }
    }
  }

  // Aktív bizonylatok
  const { data: existing } = await supabase
    .from('invoices')
    .select(
      'id, invoice_type, provider_invoice_number, gross_total, is_storno_of_invoice_id'
    )
    .eq('tenant_id', tenantId)
    .eq('related_source_type', 'sale')
    .eq('related_source_id', input.saleId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const rows = existing ?? []
  const stornoOf = new Set(
    rows
      .filter((r) => r.invoice_type === 'sztorno' && r.is_storno_of_invoice_id)
      .map((r) => r.is_storno_of_invoice_id as string)
  )

  const activeFinal = rows.find(
    (r) =>
      r.invoice_type === 'szamla' &&
      !r.is_storno_of_invoice_id &&
      !stornoOf.has(r.id)
  )
  if (input.kind === 'normal' && activeFinal) {
    return {
      ok: false,
      message:
        'Ehhez az eladáshoz már van aktív számla. Előbb sztornózd, ha újat szeretnél.'
    }
  }

  const activeAdvance = rows.find(
    (r) =>
      r.invoice_type === 'elolegszamla' &&
      !stornoOf.has(r.id) &&
      r.provider_invoice_number
  )
  const activeProforma = rows.find(
    (r) =>
      r.invoice_type === 'dijbekero' &&
      !stornoOf.has(r.id) &&
      r.provider_invoice_number
  )

  if (input.kind === 'proforma' && activeProforma) {
    return {
      ok: false,
      message:
        'Már van aktív díjbekérő. Sztornózd / töröld, vagy állíts ki végszámlát fizetés után.'
    }
  }

  if (input.kind === 'normal' && detail.payment_status !== 'paid') {
    return {
      ok: false,
      message:
        'Végszámlát csak fizetett eladáshoz állíthatsz ki. Használj díjbekérőt vagy előleget, vagy jelöld fizetettnek.'
    }
  }

  if (input.kind === 'normal' && detail.status === 'confirmed') {
    return {
      ok: false,
      message:
        'Előbb add át az árut (Áru átadása), aztán állíts ki végszámlát.'
    }
  }

  const company = await getOrCreateTenantCompany(
    supabase,
    tenantId,
    'Cég',
    { createIfMissing: false }
  )

  const buyerName =
    detail.customer.billing_name?.trim() ||
    detail.customer.name?.trim() ||
    'Vevő'
  const email =
    (input.customerEmail || detail.customer.email || '').trim()
  const street = [
    detail.customer.billing_street,
    detail.customer.billing_house_number
  ]
    .filter(Boolean)
    .join(' ')

  const amountGross =
    input.kind === 'advance'
      ? Number(input.advanceAmount)
      : input.kind === 'proforma'
        ? Number(input.proformaAmount) || undefined
        : undefined

  let xml: string
  try {
    xml = buildSaleInvoiceXml({
      agentKey: settings.agent_key!.trim(),
      kind: input.kind,
      paymentMethod: input.paymentMethod || detectPaymentMethod(detail),
      dueDate: input.dueDate,
      fulfillmentDate: input.fulfillmentDate,
      comment: input.comment || '',
      language: input.language || settings.default_language || 'hu',
      sendEmail:
        input.sendEmail ?? settings.default_send_email ?? true,
      markAsPaid:
        input.markAsPaid ?? detail.payment_status === 'paid',
      orderNumber: detail.sale_number,
      buyer: {
        name: buyerName,
        postalCode: detail.customer.billing_postal_code || '',
        city: detail.customer.billing_city || '',
        address: street,
        email,
        taxNumber: detail.customer.billing_tax_number || ''
      },
      seller: { email: company?.email ?? null },
      lines,
      amountGross: amountGross && amountGross > 0 ? amountGross : null,
      existingAdvanceNumber: activeAdvance?.provider_invoice_number ?? null,
      existingProformaNumber: activeProforma?.provider_invoice_number ?? null
    })
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'XML összeállítás sikertelen.'
    }
  }

  const posted = await postSzamlazzXml({
    agentKey: settings.agent_key!.trim(),
    apiUrl: settings.api_url,
    xml
  })
  if (!posted.ok) return { ok: false, message: posted.error }

  const storedType = issueKindToStoredType(input.kind)
  const gross =
    amountGross && amountGross > 0
      ? amountGross
      : detail.total_gross + detail.cash_rounding_amount

  const { data: inserted, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      provider: 'szamlazz_hu',
      provider_invoice_number: posted.invoiceNumber,
      invoice_type: storedType,
      related_source_type: 'sale',
      related_source_id: input.saleId,
      related_source_number: detail.sale_number,
      customer_name: buyerName,
      customer_id: detail.customer_id,
      customer_email: email || null,
      payment_due_date: input.dueDate || null,
      fulfillment_date: input.fulfillmentDate || null,
      gross_total: gross,
      payment_status:
        input.kind === 'normal' && detail.payment_status === 'paid'
          ? 'fizetve'
          : 'pending',
      note: input.comment || null,
      created_by: userId
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('issueInvoiceFromSale insert', insertErr?.message)
    return {
      ok: false,
      message:
        `A számla elkészült a Számlázz.hu-n (${posted.invoiceNumber}), de nem sikerült menteni. Ellenőrizd a Számlázz fiókot.`
    }
  }

  return {
    ok: true,
    invoiceId: inserted.id as string,
    providerNumber: posted.invoiceNumber
  }
}

export type PreviewSaleInvoiceResult =
  | { ok: true; pdfBase64: string }
  | { ok: false; message: string }

/** Agent elonezetpdf — nem ment invoices sort. */
export async function previewSaleInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  input: IssueSaleInvoiceInput
): Promise<PreviewSaleInvoiceResult> {
  const settings = await getOrCreateInvoiceSettings(supabase, tenantId)
  if (!hasAgentKey(settings)) {
    return {
      ok: false,
      message:
        'Nincs Számlázz.hu Agent kulcs. Állítsd be: Beállítások → Számlázás.'
    }
  }

  const detail = await getSale(supabase, tenantId, input.saleId)
  if (!detail) return { ok: false, message: 'Az értékesítés nem található.' }
  if (!saleHasBilling(detail)) {
    return {
      ok: false,
      message: 'Hiányoznak a számlázási adatok (név / cím).'
    }
  }

  const lines = mapSaleLines(detail)
  if (lines.length === 0) {
    return { ok: false, message: 'Nincs tétel az értékesítésen.' }
  }

  if (input.kind === 'normal' && detail.status === 'confirmed') {
    return {
      ok: false,
      message:
        'Előbb add át az árut (Áru átadása), aztán állíts ki végszámlát.'
    }
  }

  const { data: existing } = await supabase
    .from('invoices')
    .select('id, invoice_type, provider_invoice_number, is_storno_of_invoice_id')
    .eq('tenant_id', tenantId)
    .eq('related_source_type', 'sale')
    .eq('related_source_id', input.saleId)
    .is('deleted_at', null)

  const rows = existing ?? []
  const stornoOf = new Set(
    rows
      .filter((r) => r.invoice_type === 'sztorno' && r.is_storno_of_invoice_id)
      .map((r) => r.is_storno_of_invoice_id as string)
  )
  const activeAdvance = rows.find(
    (r) =>
      r.invoice_type === 'elolegszamla' &&
      !stornoOf.has(r.id) &&
      r.provider_invoice_number
  )
  const activeProforma = rows.find(
    (r) =>
      r.invoice_type === 'dijbekero' &&
      !stornoOf.has(r.id) &&
      r.provider_invoice_number
  )

  const company = await getOrCreateTenantCompany(supabase, tenantId, 'Cég', {
    createIfMissing: false
  })

  const buyerName =
    detail.customer.billing_name?.trim() ||
    detail.customer.name?.trim() ||
    'Vevő'
  const email = (input.customerEmail || detail.customer.email || '').trim()
  const street = [
    detail.customer.billing_street,
    detail.customer.billing_house_number
  ]
    .filter(Boolean)
    .join(' ')

  const amountGross =
    input.kind === 'advance'
      ? Number(input.advanceAmount)
      : input.kind === 'proforma'
        ? Number(input.proformaAmount) || undefined
        : undefined

  let xml: string
  try {
    xml = buildSaleInvoiceXml({
      agentKey: settings.agent_key!.trim(),
      kind: input.kind,
      paymentMethod: input.paymentMethod || detectPaymentMethod(detail),
      dueDate: input.dueDate,
      fulfillmentDate: input.fulfillmentDate,
      comment: input.comment || '',
      language: input.language || settings.default_language || 'hu',
      sendEmail: false,
      markAsPaid: false,
      orderNumber: `${detail.sale_number}-PREVIEW`,
      preview: true,
      buyer: {
        name: buyerName,
        postalCode: detail.customer.billing_postal_code || '',
        city: detail.customer.billing_city || '',
        address: street,
        email,
        taxNumber: detail.customer.billing_tax_number || ''
      },
      seller: { email: company?.email ?? null },
      lines,
      amountGross: amountGross && amountGross > 0 ? amountGross : null,
      existingAdvanceNumber: activeAdvance?.provider_invoice_number ?? null,
      existingProformaNumber: activeProforma?.provider_invoice_number ?? null
    })
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'XML összeállítás sikertelen.'
    }
  }

  const posted = await postSzamlazzXml({
    agentKey: settings.agent_key!.trim(),
    apiUrl: settings.api_url,
    xml,
    preview: true
  })
  if (!posted.ok) return { ok: false, message: posted.error }
  if (!posted.pdfBuffer) {
    return { ok: false, message: 'Az előnézet PDF nem érkezett meg.' }
  }

  const bytes = new Uint8Array(posted.pdfBuffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }

  return { ok: true, pdfBase64: btoa(binary) }
}

export async function stornoInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null,
  invoiceId: string
): Promise<IssueResult> {
  const settings = await getOrCreateInvoiceSettings(supabase, tenantId)
  if (!hasAgentKey(settings)) {
    return {
      ok: false,
      message: 'Nincs Számlázz.hu Agent kulcs. Állítsd be: Beállítások → Számlázás.'
    }
  }

  const { data: inv, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_type, provider_invoice_number, related_source_type, related_source_id, related_source_number, customer_name, customer_id, customer_email, gross_total'
    )
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !inv) {
    return { ok: false, message: 'A számla nem található.' }
  }
  if (inv.invoice_type === 'sztorno') {
    return { ok: false, message: 'Sztornó számla nem sztornózható.' }
  }
  if (!inv.provider_invoice_number?.trim()) {
    return { ok: false, message: 'Nincs szolgáltatói számlaszám.' }
  }

  // Felhasznált dijbekérő / előleg: van aktív végszámla ugyanarra a forrásra
  if (
    (inv.invoice_type === 'dijbekero' || inv.invoice_type === 'elolegszamla') &&
    inv.related_source_id &&
    (inv.related_source_type === 'sale' ||
      inv.related_source_type === 'opti_order')
  ) {
    const { data: related } = await supabase
      .from('invoices')
      .select('id, invoice_type, is_storno_of_invoice_id')
      .eq('tenant_id', tenantId)
      .eq('related_source_type', inv.related_source_type)
      .eq('related_source_id', inv.related_source_id)
      .is('deleted_at', null)
    const rows = related ?? []
    const stornoOf = new Set(
      rows
        .filter((r) => r.invoice_type === 'sztorno' && r.is_storno_of_invoice_id)
        .map((r) => r.is_storno_of_invoice_id as string)
    )
    const hasFinal = rows.some(
      (r) => r.invoice_type === 'szamla' && !stornoOf.has(r.id)
    )
    if (hasFinal) {
      return {
        ok: false,
        message:
          'A díjbekérő / előleg a végszámlához kapcsolódik — nem sztornózható. Csak a végszámlát sztornózd.'
      }
    }
  }

  const { data: already } = await supabase
    .from('invoices')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('invoice_type', 'sztorno')
    .eq('is_storno_of_invoice_id', invoiceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (already) {
    return { ok: false, message: 'Ehhez a számlához már készült sztornó.' }
  }

  const xml = buildStornoXml({
    agentKey: settings.agent_key!.trim(),
    invoiceNumber: inv.provider_invoice_number,
    buyerEmail: inv.customer_email
  })

  const posted = await postSzamlazzXml({
    agentKey: settings.agent_key!.trim(),
    apiUrl: settings.api_url,
    xml,
    actionField: 'action-szamla_agent_st'
  })
  if (!posted.ok) return { ok: false, message: posted.error }

  const { data: inserted, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      provider: 'szamlazz_hu',
      provider_invoice_number: posted.invoiceNumber,
      invoice_type: 'sztorno',
      related_source_type: inv.related_source_type,
      related_source_id: inv.related_source_id,
      related_source_number: inv.related_source_number,
      customer_name: inv.customer_name,
      customer_id: inv.customer_id,
      customer_email: inv.customer_email,
      gross_total: inv.gross_total != null ? -Math.abs(Number(inv.gross_total)) : null,
      payment_status: 'nem_lesz_fizetve',
      is_storno_of_invoice_id: inv.id,
      created_by: userId
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('stornoInvoice insert', insertErr?.message)
    return {
      ok: false,
      message: `Sztornó készült (${posted.invoiceNumber}), mentés sikertelen.`
    }
  }

  return {
    ok: true,
    invoiceId: inserted.id as string,
    providerNumber: posted.invoiceNumber
  }
}

export async function getInvoicePdfBuffer(
  supabase: SupabaseClient,
  tenantId: string,
  invoiceId: string
): Promise<{ ok: true; pdf: ArrayBuffer; filename: string } | { ok: false; message: string }> {
  const settings = await getOrCreateInvoiceSettings(supabase, tenantId)
  if (!hasAgentKey(settings)) {
    return { ok: false, message: 'Nincs Agent kulcs.' }
  }

  const { data: inv } = await supabase
    .from('invoices')
    .select('provider_invoice_number, internal_number')
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!inv?.provider_invoice_number) {
    return { ok: false, message: 'Nincs szolgáltatói számlaszám.' }
  }

  const pdf = await fetchSzamlazzPdf({
    agentKey: settings.agent_key!.trim(),
    apiUrl: settings.api_url,
    invoiceNumber: inv.provider_invoice_number
  })
  if (!pdf.ok) return { ok: false, message: pdf.error }

  return {
    ok: true,
    pdf: pdf.pdf,
    filename: `${inv.provider_invoice_number || inv.internal_number}.pdf`
  }
}
