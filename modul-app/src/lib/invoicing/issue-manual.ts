import { randomUUID } from 'crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { getOrCreateTenantCompany } from '@/lib/company/queries'
import {
  insertInvoiceLines,
  sumInvoiceLines
} from '@/lib/finance/invoice-lines'
import { isFinancePeriodLocked } from '@/lib/finance/period-lock'
import { postSzamlazzXml } from '@/lib/invoicing/szamlazz-agent'
import {
  buildSaleInvoiceXml,
  type SaleInvoiceBuyer,
  type SaleInvoiceLine
} from '@/lib/invoicing/szamlazz-xml'
import { getOrCreateInvoiceSettings, hasAgentKey } from '@/lib/invoicing/settings'
import { isInvoicePaymentMethodAllowed } from '@/lib/invoicing/payment-method'
import {
  issueKindToStoredType,
  type InvoiceIssueKind,
  type InvoicePaymentMethod
} from '@/lib/invoicing/types'

export type ManualInvoiceLineInput = {
  name: string
  quantity: number
  unit: string
  unitNet: number
  vatPercent: number
}

export type ManualInvoiceBuyerInput = {
  name: string
  postalCode: string
  city: string
  address: string
  email: string
  taxNumber: string
}

export type IssueManualInvoiceInput = {
  kind: InvoiceIssueKind
  paymentMethod: InvoicePaymentMethod
  dueDate: string
  fulfillmentDate: string
  comment?: string
  language?: string
  sendEmail?: boolean
  /** Számla (normal): KP/kártya → fizetve jelölés */
  markAsPaid?: boolean
  advanceAmount?: number
  proformaAmount?: number
  customerId?: string | null
  buyer: ManualInvoiceBuyerInput
  lines: ManualInvoiceLineInput[]
  /** Opcionális rendelésszám / hivatkozás a számlán */
  reference?: string
}

export type IssueResult =
  | { ok: true; invoiceId: string; providerNumber: string }
  | { ok: false; message: string }

export type PreviewResult =
  | { ok: true; pdfBase64: string }
  | { ok: false; message: string }

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeLines(
  lines: ManualInvoiceLineInput[]
): SaleInvoiceLine[] {
  const out: SaleInvoiceLine[] = []
  for (const raw of lines) {
    const name = raw.name.trim()
    const qty = Number(raw.quantity)
    const unitNet = Number(raw.unitNet)
    const vatPercent = Math.round(Math.abs(Number(raw.vatPercent))) || 0
    if (!name || !(qty > 0) || !Number.isFinite(unitNet)) continue
    const lineNet = Math.round(unitNet * qty)
    const lineVat = Math.round((lineNet * vatPercent) / 100)
    const lineGross = lineNet + lineVat
    if (lineGross === 0 && lineNet === 0) continue
    out.push({
      name,
      quantity: qty,
      unit: (raw.unit || 'db').trim() || 'db',
      unitNet,
      vatPercent,
      lineNet,
      lineVat,
      lineGross
    })
  }
  return out
}

function validateBuyer(buyer: ManualInvoiceBuyerInput): string | null {
  if (!buyer.name.trim()) return 'A vevő neve kötelező.'
  if (!buyer.city.trim() && !buyer.address.trim()) {
    return 'Add meg a vevő címét (település vagy utca).'
  }
  return null
}

function buildBuyer(buyer: ManualInvoiceBuyerInput): SaleInvoiceBuyer {
  return {
    name: buyer.name.trim(),
    postalCode: buyer.postalCode.trim(),
    city: buyer.city.trim(),
    address: buyer.address.trim(),
    email: buyer.email.trim(),
    taxNumber: buyer.taxNumber.trim()
  }
}

function orderNumber(reference: string | undefined, preview: boolean): string {
  const ref = reference?.trim()
  if (ref) return preview ? `${ref}-PREVIEW` : ref
  const d = todayIso().replace(/-/g, '')
  return preview ? `KEZI-${d}-PREVIEW` : `KEZI-${d}`
}

function amountGrossFromInput(
  kind: InvoiceIssueKind,
  input: IssueManualInvoiceInput
): number | null {
  if (kind === 'advance') {
    const n = Number(input.advanceAmount)
    return n > 0 ? n : null
  }
  if (kind === 'proforma') {
    const n = Number(input.proformaAmount)
    return n > 0 ? n : null
  }
  return null
}

function advanceSnapshotLines(amountGross: number): SaleInvoiceLine[] {
  const vatRate = 27
  const brutto = Math.round(amountGross)
  const vat = Math.round((brutto / (100 + vatRate)) * vatRate)
  const net = brutto - vat
  return [
    {
      name: 'Előleg',
      quantity: 1,
      unit: 'db',
      unitNet: net,
      vatPercent: vatRate,
      lineNet: net,
      lineVat: vat,
      lineGross: brutto
    }
  ]
}

async function buildXmlAndPost(
  supabase: SupabaseClient,
  tenantId: string,
  input: IssueManualInvoiceInput,
  opts: { preview: boolean; externalId?: string }
): Promise<
  | {
      ok: true
      invoiceNumber: string
      pdfBuffer: ArrayBuffer | null
      lines: SaleInvoiceLine[]
      snapshotLines: SaleInvoiceLine[]
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

  const buyerErr = validateBuyer(input.buyer)
  if (buyerErr) return { ok: false, message: buyerErr }

  if (!isInvoicePaymentMethodAllowed(input.kind, input.paymentMethod)) {
    return {
      ok: false,
      message: 'Díjbekérőn csak átutalás választható.'
    }
  }

  const lines = normalizeLines(input.lines)
  const amountGross = amountGrossFromInput(input.kind, input)

  if (input.kind === 'advance') {
    if (!amountGross || !(amountGross > 0)) {
      return { ok: false, message: 'Add meg az előleg bruttó összegét.' }
    }
  } else if (lines.length === 0) {
    return { ok: false, message: 'Legalább egy érvényes tétel kell.' }
  }

  const lock = await isFinancePeriodLocked(
    supabase,
    tenantId,
    input.fulfillmentDate
  )
  if (lock.locked) {
    return {
      ok: false,
      message: `A ${lock.periodYm} időszak le van zárva. Feloldás: Pénzügy → Exportok.`
    }
  }

  const company = await getOrCreateTenantCompany(supabase, tenantId, 'Cég', {
    createIfMissing: false
  })

  const snapshotLines =
    input.kind === 'advance' && amountGross
      ? advanceSnapshotLines(amountGross)
      : amountGross && input.kind === 'proforma'
        ? advanceSnapshotLines(amountGross).map((l) => ({
            ...l,
            name: 'Díjbekérő'
          }))
        : lines

  let xml: string
  try {
    xml = buildSaleInvoiceXml({
      agentKey: settings.agent_key!.trim(),
      kind: input.kind,
      paymentMethod: input.paymentMethod,
      dueDate: input.dueDate || todayIso(),
      fulfillmentDate: input.fulfillmentDate || todayIso(),
      comment: input.comment || '',
      language: input.language || settings.default_language || 'hu',
      sendEmail: opts.preview
        ? false
        : (input.sendEmail ?? settings.default_send_email ?? true),
      markAsPaid: opts.preview
        ? false
        : Boolean(input.markAsPaid && input.kind === 'normal'),
      orderNumber: orderNumber(input.reference, opts.preview),
      preview: opts.preview,
      externalId: opts.externalId,
      buyer: buildBuyer(input.buyer),
      seller: { email: company?.email ?? null },
      lines,
      amountGross,
      existingAdvanceNumber: null,
      existingProformaNumber: null
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
    preview: opts.preview
  })
  if (!posted.ok) return { ok: false, message: posted.error }

  return {
    ok: true,
    invoiceNumber: posted.invoiceNumber,
    pdfBuffer: posted.pdfBuffer,
    lines,
    snapshotLines
  }
}

export async function previewManualInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  input: IssueManualInvoiceInput
): Promise<PreviewResult> {
  const built = await buildXmlAndPost(supabase, tenantId, input, {
    preview: true
  })
  if (!built.ok) return built
  if (!built.pdfBuffer) {
    return { ok: false, message: 'Az előnézet PDF nem érkezett meg.' }
  }

  const bytes = new Uint8Array(built.pdfBuffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return { ok: true, pdfBase64: btoa(binary) }
}

export async function issueManualInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null,
  input: IssueManualInvoiceInput
): Promise<IssueResult> {
  const invoiceId = randomUUID()
  const built = await buildXmlAndPost(supabase, tenantId, input, {
    preview: false,
    externalId: invoiceId
  })
  if (!built.ok) return built

  if (!built.invoiceNumber) {
    return {
      ok: false,
      message:
        'A Számlázz.hu nem adott vissza számlaszámot. Ellenőrizd a Agent kulcsot.'
    }
  }

  const totals = sumInvoiceLines(built.snapshotLines)
  const amountGross = amountGrossFromInput(input.kind, input)
  const gross =
    amountGross && amountGross > 0
      ? Math.round(amountGross)
      : totals.gross
  const markPaid = Boolean(input.markAsPaid && input.kind === 'normal')
  const buyer = buildBuyer(input.buyer)
  const storedType = issueKindToStoredType(input.kind)

  const { data: inserted, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      id: invoiceId,
      tenant_id: tenantId,
      provider: 'szamlazz_hu',
      provider_invoice_number: built.invoiceNumber,
      invoice_type: storedType,
      related_source_type: 'manual',
      related_source_id: null,
      related_source_number: input.reference?.trim() || null,
      customer_name: buyer.name,
      customer_id: input.customerId || null,
      customer_email: buyer.email || null,
      payment_due_date: input.dueDate || null,
      fulfillment_date: input.fulfillmentDate || null,
      gross_total: gross,
      net_total: totals.net,
      vat_total: totals.vat,
      external_id: invoiceId,
      paid_amount: markPaid ? gross : 0,
      payment_status: markPaid ? 'fizetve' : 'pending',
      note: input.comment || null,
      created_by: userId
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('issueManualInvoice insert', insertErr?.message)
    return {
      ok: false,
      message: `A számla elkészült a Számlázz.hu-n (${built.invoiceNumber}), de nem sikerült menteni. Ellenőrizd a Számlázz fiókot.`
    }
  }

  await insertInvoiceLines(supabase, tenantId, invoiceId, built.snapshotLines)

  if (markPaid && gross > 0) {
    const { error: payErr } = await supabase.from('invoice_payments').insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      paid_at: input.fulfillmentDate || todayIso(),
      amount: gross,
      method:
        input.paymentMethod === 'cash' || input.paymentMethod === 'card'
          ? input.paymentMethod
          : 'bank_transfer',
      note: 'Kiállításkor fizetve',
      agent_synced: true,
      created_by: userId
    })
    if (payErr) {
      console.error('issueManualInvoice payment', payErr.message)
    }
  }

  return {
    ok: true,
    invoiceId,
    providerNumber: built.invoiceNumber
  }
}
