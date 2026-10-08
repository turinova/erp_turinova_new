import { randomUUID } from 'crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { getOrCreateTenantCompany } from '@/lib/company/queries'
import {
  insertInvoiceLines,
  sumInvoiceLines
} from '@/lib/finance/invoice-lines'
import { isFinancePeriodLocked } from '@/lib/finance/period-lock'
import type { ConsolidateSourceType } from '@/lib/invoicing/eligible-consolidate'
import { activeDocs } from '@/lib/invoicing/invoice-rules'
import {
  mapQuoteInvoiceLines,
  quoteHasBilling
} from '@/lib/invoicing/quote-invoice-lines'
import { postSzamlazzXml } from '@/lib/invoicing/szamlazz-agent'
import {
  buildSaleInvoiceXml,
  type SaleInvoiceBuyer,
  type SaleInvoiceLine
} from '@/lib/invoicing/szamlazz-xml'
import { getOrCreateInvoiceSettings, hasAgentKey } from '@/lib/invoicing/settings'
import type { InvoicePaymentMethod } from '@/lib/invoicing/types'
import { getQuoteDetail } from '@/lib/quotes/queries'
import { getSale, type SaleDetail } from '@/lib/sales/queries'

export type ConsolidateSourceRef = {
  sourceType: ConsolidateSourceType
  sourceId: string
}

export type IssueConsolidatedInput = {
  sources: ConsolidateSourceRef[]
  paymentMethod: InvoicePaymentMethod
  dueDate: string
  fulfillmentDate: string
  comment?: string
  language?: string
  sendEmail?: boolean
  markAsPaid?: boolean
  customerId: string
  buyer: {
    name: string
    postalCode: string
    city: string
    address: string
    email: string
    taxNumber: string
  }
  /** UI-ban szerkesztett tételek — ha üres, forrásból újraépül. */
  lines?: {
    name: string
    quantity: number
    unit: string
    unitNet: number
    vatPercent: number
  }[]
}

export type IssueResult =
  | { ok: true; invoiceId: string; providerNumber: string }
  | { ok: false; message: string }

export type PreviewResult =
  | { ok: true; pdfBase64: string }
  | { ok: false; message: string }

export type PullLinesResult =
  | {
      ok: true
      lines: {
        name: string
        quantity: number
        unit: string
        unitNet: number
        vatPercent: number
      }[]
      buyer: IssueConsolidatedInput['buyer']
      reference: string
      sourceNumbers: string[]
    }
  | { ok: false; message: string }

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function mapSaleLines(detail: SaleDetail): SaleInvoiceLine[] {
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

function saleHasBilling(detail: SaleDetail): boolean {
  const c = detail.customer
  return Boolean(
    c.billing_name?.trim() ||
      c.billing_city?.trim() ||
      c.billing_street?.trim() ||
      c.name?.trim()
  )
}

function validateBuyer(buyer: IssueConsolidatedInput['buyer']): string | null {
  if (!buyer.name.trim()) return 'A vevő neve kötelező.'
  if (!buyer.city.trim() && !buyer.address.trim()) {
    return 'Add meg a vevő címét (település vagy utca).'
  }
  return null
}

function prefixLines(
  lines: SaleInvoiceLine[],
  sourceNumber: string
): SaleInvoiceLine[] {
  const tag = sourceNumber.trim() || '—'
  return lines.map((l) => ({
    ...l,
    name: `[${tag}] ${l.name}`
  }))
}

async function sourceAlreadyInvoiced(
  supabase: SupabaseClient,
  tenantId: string,
  sourceType: ConsolidateSourceType,
  sourceId: string
): Promise<boolean> {
  const { data: directs } = await supabase
    .from('invoices')
    .select('id, invoice_type, is_storno_of_invoice_id')
    .eq('tenant_id', tenantId)
    .eq('related_source_type', sourceType)
    .eq('related_source_id', sourceId)
    .is('deleted_at', null)

  if (activeDocs((directs ?? []) as never).hasFinal) return true

  const { data: links } = await supabase
    .from('invoice_source_links')
    .select('invoice_id')
    .eq('tenant_id', tenantId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)

  if (!links?.length) return false

  const { data: invs } = await supabase
    .from('invoices')
    .select('id, invoice_type, is_storno_of_invoice_id')
    .eq('tenant_id', tenantId)
    .in(
      'id',
      links.map((l) => l.invoice_id)
    )
    .is('deleted_at', null)

  return activeDocs((invs ?? []) as never).hasFinal
}

type ResolvedSource = {
  sourceType: ConsolidateSourceType
  sourceId: string
  sourceNumber: string
  lines: SaleInvoiceLine[]
  buyerSeed: IssueConsolidatedInput['buyer'] | null
}

async function resolveSources(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string,
  sources: ConsolidateSourceRef[]
): Promise<{ ok: true; resolved: ResolvedSource[] } | { ok: false; message: string }> {
  if (sources.length < 1) {
    return { ok: false, message: 'Válassz legalább egy megrendelést.' }
  }
  if (sources.length > 25) {
    return { ok: false, message: 'Egyszerre legfeljebb 25 forrás választható.' }
  }

  const seen = new Set<string>()
  const resolved: ResolvedSource[] = []

  for (const ref of sources) {
    const key = `${ref.sourceType}:${ref.sourceId}`
    if (seen.has(key)) continue
    seen.add(key)

    if (await sourceAlreadyInvoiced(supabase, tenantId, ref.sourceType, ref.sourceId)) {
      return {
        ok: false,
        message: 'Egy kiválasztott forráshoz már van aktív végszámla.'
      }
    }

    if (ref.sourceType === 'sale') {
      const detail = await getSale(supabase, tenantId, ref.sourceId)
      if (!detail) {
        return { ok: false, message: 'Értékesítés nem található.' }
      }
      if (detail.customer_id !== customerId) {
        return { ok: false, message: 'Minden forrásnak ugyanahhoz az ügyfélhez kell tartoznia.' }
      }
      if (detail.payment_status !== 'paid') {
        return { ok: false, message: `${detail.sale_number}: még nincs fizetve.` }
      }
      if (
        detail.status === 'confirmed' ||
        detail.status === 'cancelled' ||
        detail.status === 'returned'
      ) {
        return {
          ok: false,
          message: `${detail.sale_number}: nem számlázható ebben a státuszban.`
        }
      }
      if (!saleHasBilling(detail)) {
        return {
          ok: false,
          message: `${detail.sale_number}: hiányoznak a számlázási adatok.`
        }
      }
      const lines = mapSaleLines(detail)
      if (lines.length === 0) {
        return { ok: false, message: `${detail.sale_number}: nincs tétel.` }
      }
      const c = detail.customer
      const street = [c.billing_street, c.billing_house_number]
        .filter(Boolean)
        .join(' ')
      resolved.push({
        sourceType: 'sale',
        sourceId: detail.id,
        sourceNumber: detail.sale_number,
        lines: prefixLines(lines, detail.sale_number),
        buyerSeed: {
          name: (c.billing_name || c.name || detail.customer_name || '').trim(),
          postalCode: (c.billing_postal_code || '').trim(),
          city: (c.billing_city || '').trim(),
          address: street,
          email: (c.email || '').trim(),
          taxNumber: (c.billing_tax_number || '').trim()
        }
      })
      continue
    }

    const detail = await getQuoteDetail(supabase, tenantId, ref.sourceId)
    if (!detail) {
      return { ok: false, message: 'Lapszabászat nem található.' }
    }
    if (detail.customer.id !== customerId) {
      return { ok: false, message: 'Minden forrásnak ugyanahhoz az ügyfélhez kell tartoznia.' }
    }
    if (detail.payment_status !== 'paid') {
      return {
        ok: false,
        message: `${detail.order_number || detail.quote_number}: még nincs fizetve.`
      }
    }
    if (
      detail.status === 'draft' ||
      detail.status === 'cancelled'
    ) {
      return {
        ok: false,
        message: `${detail.order_number || detail.quote_number}: nem számlázható ebben a státuszban.`
      }
    }
    if (!quoteHasBilling(detail)) {
      return {
        ok: false,
        message: `${detail.order_number || detail.quote_number}: hiányoznak a számlázási adatok.`
      }
    }
    const mapped = mapQuoteInvoiceLines(detail, { detailLevel: 'summary' })
    if (!mapped.ok) return mapped
    if (mapped.lines.length === 0) {
      return {
        ok: false,
        message: `${detail.order_number || detail.quote_number}: nincs tétel.`
      }
    }
    const num =
      detail.order_number?.trim() || detail.quote_number || '—'
    const c = detail.customer
    const street = [c.billing_street, c.billing_house_number]
      .filter(Boolean)
      .join(' ')
    resolved.push({
      sourceType: 'opti_order',
      sourceId: detail.id,
      sourceNumber: num,
      lines: prefixLines(
        mapped.lines.map((l) => ({
          name: l.name,
          quantity: l.quantity,
          unit: l.unit,
          unitNet: l.unitNet,
          vatPercent: l.vatPercent,
          lineNet: l.lineNet,
          lineVat: l.lineVat,
          lineGross: l.lineGross
        })),
        num
      ),
      buyerSeed: {
        name: (c.billing_name || c.name || '').trim(),
        postalCode: (c.billing_postal_code || '').trim(),
        city: (c.billing_city || '').trim(),
        address: street,
        email: (c.email || '').trim(),
        taxNumber: (c.billing_tax_number || '').trim()
      }
    })
  }

  if (resolved.length === 0) {
    return { ok: false, message: 'Nincs érvényes forrás.' }
  }

  return { ok: true, resolved }
}

/** Tételek behúzása UI-hoz (szerkeszthető draft). */
export async function pullConsolidatedLines(
  supabase: SupabaseClient,
  tenantId: string,
  customerId: string,
  sources: ConsolidateSourceRef[]
): Promise<PullLinesResult> {
  const resolved = await resolveSources(supabase, tenantId, customerId, sources)
  if (!resolved.ok) return resolved

  const lines = resolved.resolved.flatMap((r) =>
    r.lines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      unit: l.unit,
      unitNet: Math.round(l.unitNet * 100) / 100,
      vatPercent: l.vatPercent
    }))
  )
  const buyer =
    resolved.resolved.find((r) => r.buyerSeed?.name)?.buyerSeed ?? {
      name: '',
      postalCode: '',
      city: '',
      address: '',
      email: '',
      taxNumber: ''
    }
  const sourceNumbers = resolved.resolved.map((r) => r.sourceNumber)

  return {
    ok: true,
    lines,
    buyer,
    reference: sourceNumbers.join(', ').slice(0, 120),
    sourceNumbers
  }
}

async function buildXmlAndPost(
  supabase: SupabaseClient,
  tenantId: string,
  input: IssueConsolidatedInput,
  opts: { preview: boolean; externalId?: string }
): Promise<
  | {
      ok: true
      invoiceNumber: string
      pdfBuffer: ArrayBuffer | null
      lines: SaleInvoiceLine[]
      resolved: ResolvedSource[]
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

  const resolved = await resolveSources(
    supabase,
    tenantId,
    input.customerId,
    input.sources
  )
  if (!resolved.ok) return resolved

  let lines: SaleInvoiceLine[]
  if (input.lines && input.lines.length > 0) {
    lines = []
    for (const raw of input.lines) {
      const name = raw.name.trim()
      const qty = Number(raw.quantity)
      const unitNet = Number(raw.unitNet)
      const vatPercent = Math.round(Math.abs(Number(raw.vatPercent))) || 0
      if (!name || !(qty > 0) || !Number.isFinite(unitNet)) continue
      const lineNet = Math.round(unitNet * qty)
      const lineVat = Math.round((lineNet * vatPercent) / 100)
      const lineGross = lineNet + lineVat
      if (lineGross === 0 && lineNet === 0) continue
      lines.push({
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
  } else {
    lines = resolved.resolved.flatMap((r) => r.lines)
  }
  if (lines.length === 0) {
    return { ok: false, message: 'Nincs tétel a kiválasztott forrásokon.' }
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

  const ref = resolved.resolved
    .map((r) => r.sourceNumber)
    .join(', ')
    .slice(0, 100)
  const orderNumber = opts.preview ? `${ref || 'OSSZEVONT'}-PREVIEW` : ref || 'OSSZEVONT'

  const buyer: SaleInvoiceBuyer = {
    name: input.buyer.name.trim(),
    postalCode: input.buyer.postalCode.trim(),
    city: input.buyer.city.trim(),
    address: input.buyer.address.trim(),
    email: input.buyer.email.trim(),
    taxNumber: input.buyer.taxNumber.trim()
  }

  let xml: string
  try {
    xml = buildSaleInvoiceXml({
      agentKey: settings.agent_key!.trim(),
      kind: 'normal',
      paymentMethod: input.paymentMethod,
      dueDate: input.dueDate || todayIso(),
      fulfillmentDate: input.fulfillmentDate || todayIso(),
      comment: input.comment || '',
      language: input.language || settings.default_language || 'hu',
      sendEmail: opts.preview
        ? false
        : (input.sendEmail ?? settings.default_send_email ?? true),
      markAsPaid: opts.preview ? false : Boolean(input.markAsPaid),
      orderNumber,
      preview: opts.preview,
      externalId: opts.externalId,
      buyer,
      seller: { email: company?.email ?? null },
      lines,
      amountGross: null,
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
    resolved: resolved.resolved
  }
}

function pdfToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export async function previewConsolidatedInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  input: IssueConsolidatedInput
): Promise<PreviewResult> {
  const built = await buildXmlAndPost(supabase, tenantId, input, {
    preview: true
  })
  if (!built.ok) return built
  if (!built.pdfBuffer) {
    return { ok: false, message: 'Az előnézet PDF nem érkezett meg.' }
  }
  return { ok: true, pdfBase64: pdfToBase64(built.pdfBuffer) }
}

export async function issueConsolidatedInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string | null,
  input: IssueConsolidatedInput
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

  const totals = sumInvoiceLines(built.lines)
  const markPaid = Boolean(input.markAsPaid)
  const buyer = {
    name: input.buyer.name.trim(),
    email: input.buyer.email.trim()
  }
  const ref = built.resolved
    .map((r) => r.sourceNumber)
    .join(', ')
    .slice(0, 120)

  const { data: inserted, error: insertErr } = await supabase
    .from('invoices')
    .insert({
      id: invoiceId,
      tenant_id: tenantId,
      provider: 'szamlazz_hu',
      provider_invoice_number: built.invoiceNumber,
      invoice_type: 'szamla',
      related_source_type: 'consolidated',
      related_source_id: null,
      related_source_number: ref || null,
      customer_name: buyer.name,
      customer_id: input.customerId,
      customer_email: buyer.email || null,
      payment_due_date: input.dueDate || null,
      fulfillment_date: input.fulfillmentDate || null,
      gross_total: totals.gross,
      net_total: totals.net,
      vat_total: totals.vat,
      external_id: invoiceId,
      paid_amount: markPaid ? totals.gross : 0,
      payment_status: markPaid ? 'fizetve' : 'pending',
      note: input.comment || null,
      created_by: userId
    })
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('issueConsolidatedInvoice insert', insertErr?.message)
    return {
      ok: false,
      message: `A számla elkészült a Számlázz.hu-n (${built.invoiceNumber}), de nem sikerült menteni.`
    }
  }

  await insertInvoiceLines(supabase, tenantId, invoiceId, built.lines)

  const linkRows = built.resolved.map((r) => ({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    source_type: r.sourceType,
    source_id: r.sourceId,
    source_number: r.sourceNumber
  }))

  const { error: linkErr } = await supabase
    .from('invoice_source_links')
    .insert(linkRows)

  if (linkErr) {
    console.error('issueConsolidatedInvoice links', linkErr.message)
    return {
      ok: false,
      message: `Számla mentve (${built.invoiceNumber}), de a forrás-linkek sikertelenek. Ellenőrizd a listát.`
    }
  }

  if (markPaid && totals.gross > 0) {
    const { error: payErr } = await supabase.from('invoice_payments').insert({
      tenant_id: tenantId,
      invoice_id: invoiceId,
      paid_at: input.fulfillmentDate || todayIso(),
      amount: totals.gross,
      method:
        input.paymentMethod === 'cash' || input.paymentMethod === 'card'
          ? input.paymentMethod
          : 'bank_transfer',
      note: 'Összevont kiállításkor fizetve',
      agent_synced: true,
      created_by: userId
    })
    if (payErr) {
      console.error('issueConsolidatedInvoice payment', payErr.message)
    }
  }

  return {
    ok: true,
    invoiceId,
    providerNumber: built.invoiceNumber
  }
}
