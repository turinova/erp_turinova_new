import type { SupabaseClient } from '@supabase/supabase-js'

import { getOrCreateTenantCompany } from '@/lib/company/queries'
import {
  mapQuoteInvoiceLines,
  quoteHasBilling,
  type QuoteInvoiceDetailLevel,
  type QuoteInvoiceLine
} from '@/lib/invoicing/quote-invoice-lines'
import { getOrCreateInvoiceSettings, hasAgentKey } from '@/lib/invoicing/settings'
import {
  postSzamlazzXml
} from '@/lib/invoicing/szamlazz-agent'
import { buildSaleInvoiceXml } from '@/lib/invoicing/szamlazz-xml'
import {
  issueKindToStoredType,
  type InvoiceIssueKind,
  type InvoicePaymentMethod
} from '@/lib/invoicing/types'
import { getQuoteDetail, type QuoteDetail } from '@/lib/quotes/queries'

export type IssueQuoteInvoiceInput = {
  quoteId: string
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
  /** Default: summary. Előleg / részösszegű díjbekérőnél nem számít. */
  detailLevel?: QuoteInvoiceDetailLevel
}

export type IssueQuoteResult =
  | { ok: true; invoiceId: string; providerNumber: string }
  | { ok: false; message: string }

export type PreviewQuoteInvoiceResult =
  | { ok: true; pdfBase64: string }
  | { ok: false; message: string }

function detectPaymentMethod(detail: QuoteDetail): InvoicePaymentMethod {
  const name = (detail.payments[0]?.payment_method_name || '').toLowerCase()
  if (
    name.includes('készpénz') ||
    name.includes('keszpenz') ||
    name.includes('kp')
  ) {
    return 'cash'
  }
  if (name.includes('kártya') || name.includes('kartya') || name.includes('card')) {
    return 'card'
  }
  return 'bank_transfer'
}

async function loadActiveDocs(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string
) {
  const { data: existing } = await supabase
    .from('invoices')
    .select(
      'id, invoice_type, provider_invoice_number, gross_total, is_storno_of_invoice_id'
    )
    .eq('tenant_id', tenantId)
    .eq('related_source_type', 'opti_order')
    .eq('related_source_id', quoteId)
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
  return { rows, stornoOf, activeFinal, activeAdvance, activeProforma }
}

function assertCanIssue(
  detail: QuoteDetail,
  kind: InvoiceIssueKind,
  docs: Awaited<ReturnType<typeof loadActiveDocs>>
): { ok: true } | { ok: false; message: string } {
  if (detail.status === 'cancelled') {
    return { ok: false, message: 'Törölt ajánlathoz nem állítható ki számla.' }
  }
  if (!detail.order_number) {
    return {
      ok: false,
      message: 'Előbb hozd létre a megrendelést, utána számlázhatsz.'
    }
  }
  if (!quoteHasBilling(detail)) {
    return {
      ok: false,
      message:
        'Hiányoznak a számlázási adatok (név / cím). Töltsd ki az ajánlaton.'
    }
  }
  if (kind === 'normal' && docs.activeFinal) {
    return {
      ok: false,
      message:
        'Ehhez a megrendeléshez már van aktív számla. Előbb sztornózd, ha újat szeretnél.'
    }
  }
  if (kind === 'proforma' && docs.activeProforma) {
    return {
      ok: false,
      message:
        'Már van aktív díjbekérő. Sztornózd, vagy állíts ki végszámlát.'
    }
  }
  return { ok: true }
}

async function buildXmlForQuote(
  supabase: SupabaseClient,
  tenantId: string,
  detail: QuoteDetail,
  input: IssueQuoteInvoiceInput,
  opts: { preview: boolean }
): Promise<
  | {
      ok: true
      xml: string
      settings: Awaited<ReturnType<typeof getOrCreateInvoiceSettings>>
      docs: Awaited<ReturnType<typeof loadActiveDocs>>
      lines: QuoteInvoiceLine[]
    }
  | { ok: false; message: string }
> {
  const settings = await getOrCreateInvoiceSettings(supabase, tenantId)
  if (!hasAgentKey(settings)) {
    return {
      ok: false,
      message:
        'Nincs Számlázz.hu Agent kulcs. Állítsd be: Beállítások → Számlázás.'
    }
  }

  if (input.kind === 'advance') {
    const amt = Number(input.advanceAmount) || 0
    if (amt <= 0) {
      return { ok: false, message: 'Az előleg összege kötelező.' }
    }
  }

  const mapped = mapQuoteInvoiceLines(detail, {
    detailLevel: input.detailLevel ?? 'summary'
  })
  if (!mapped.ok) return mapped

  const docs = await loadActiveDocs(supabase, tenantId, detail.id)
  const gate = assertCanIssue(detail, input.kind, docs)
  if (!gate.ok) return gate

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

  const orderNumber = opts.preview
    ? `${detail.order_number}-PREVIEW`
    : detail.order_number!

  try {
    const xml = buildSaleInvoiceXml({
      agentKey: settings.agent_key!.trim(),
      kind: input.kind,
      paymentMethod: input.paymentMethod || detectPaymentMethod(detail),
      dueDate: input.dueDate,
      fulfillmentDate: input.fulfillmentDate,
      comment: input.comment || '',
      language: input.language || settings.default_language || 'hu',
      sendEmail: opts.preview
        ? false
        : (input.sendEmail ?? settings.default_send_email ?? true),
      markAsPaid: opts.preview
        ? false
        : (input.markAsPaid ?? detail.payment_status === 'paid'),
      orderNumber,
      preview: opts.preview,
      buyer: {
        name: buyerName,
        postalCode: detail.customer.billing_postal_code || '',
        city: detail.customer.billing_city || '',
        address: street,
        email,
        taxNumber: detail.customer.billing_tax_number || ''
      },
      seller: { email: company?.email ?? null },
      lines: mapped.lines,
      amountGross: amountGross && amountGross > 0 ? amountGross : null,
      existingAdvanceNumber: docs.activeAdvance?.provider_invoice_number ?? null,
      existingProformaNumber: docs.activeProforma?.provider_invoice_number ?? null
    })
    return { ok: true, xml, settings, docs, lines: mapped.lines }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'XML összeállítás sikertelen.'
    }
  }
}

export async function issueInvoiceFromQuote(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null,
  input: IssueQuoteInvoiceInput
): Promise<IssueQuoteResult> {
  const detail = await getQuoteDetail(supabase, tenantId, input.quoteId)
  if (!detail) return { ok: false, message: 'Az ajánlat nem található.' }

  const built = await buildXmlForQuote(supabase, tenantId, detail, input, {
    preview: false
  })
  if (!built.ok) return built

  const posted = await postSzamlazzXml({
    agentKey: built.settings.agent_key!.trim(),
    apiUrl: built.settings.api_url,
    xml: built.xml
  })
  if (!posted.ok) return { ok: false, message: posted.error }

  const amountGross =
    input.kind === 'advance'
      ? Number(input.advanceAmount)
      : input.kind === 'proforma'
        ? Number(input.proformaAmount) || undefined
        : undefined

  const buyerName =
    detail.customer.billing_name?.trim() ||
    detail.customer.name?.trim() ||
    'Vevő'
  const email = (input.customerEmail || detail.customer.email || '').trim()
  const gross =
    amountGross && amountGross > 0 ? amountGross : detail.final_total_gross

  const { data: inserted, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      tenant_id: tenantId,
      provider: 'szamlazz_hu',
      provider_invoice_number: posted.invoiceNumber,
      invoice_type: issueKindToStoredType(input.kind),
      related_source_type: 'opti_order',
      related_source_id: input.quoteId,
      related_source_number: detail.order_number,
      customer_name: buyerName,
      customer_id: detail.customer.id,
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
    console.error('issueInvoiceFromQuote insert', insertErr?.message)
    return {
      ok: false,
      message: `A számla elkészült a Számlázz.hu-n (${posted.invoiceNumber}), de nem sikerült menteni. Ellenőrizd a Számlázz fiókot.`
    }
  }

  return {
    ok: true,
    invoiceId: inserted.id as string,
    providerNumber: posted.invoiceNumber
  }
}

export async function previewQuoteInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  input: IssueQuoteInvoiceInput
): Promise<PreviewQuoteInvoiceResult> {
  const detail = await getQuoteDetail(supabase, tenantId, input.quoteId)
  if (!detail) return { ok: false, message: 'Az ajánlat nem található.' }

  const built = await buildXmlForQuote(supabase, tenantId, detail, input, {
    preview: true
  })
  if (!built.ok) return built

  const posted = await postSzamlazzXml({
    agentKey: built.settings.agent_key!.trim(),
    apiUrl: built.settings.api_url,
    xml: built.xml,
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
