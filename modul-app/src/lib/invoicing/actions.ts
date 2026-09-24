'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/auth/session'
import {
  getInvoicePdfBuffer,
  issueInvoiceFromSale,
  previewSaleInvoice,
  stornoInvoice
} from '@/lib/invoicing/issue-sale'
import {
  issueInvoiceFromQuote,
  previewQuoteInvoice
} from '@/lib/invoicing/issue-quote'
import type { QuoteInvoiceDetailLevel } from '@/lib/invoicing/quote-invoice-lines'
import { getOrCreateInvoiceSettings, hasAgentKey } from '@/lib/invoicing/settings'
import { testSzamlazzAgentConnection } from '@/lib/invoicing/szamlazz-agent'
import {
  HU_TAX_NUMBER_RE,
  queryTaxpayerByTaxNumber,
  type TaxpayerLookupResult
} from '@/lib/invoicing/taxpayer'
import type {
  InvoiceIssueKind,
  InvoicePaymentMethod
} from '@/lib/invoicing/types'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type InvoiceActionResult =
  | { ok: true; invoiceId?: string; providerNumber?: string; message?: string }
  | { ok: false; message: string }

function revalidateInvoicePaths(opts?: {
  saleId?: string
  quoteId?: string
  invoiceId?: string
}) {
  revalidatePath('/szamlak')
  revalidatePath('/beallitasok/szamlazas')
  if (opts?.saleId) revalidatePath(`/ertekesitesek/${opts.saleId}`)
  if (opts?.quoteId) {
    revalidatePath(`/ajanlatok/${opts.quoteId}`)
    revalidatePath('/megrendelesek')
  }
}

export async function saveInvoiceSettingsAction(input: {
  agentKey: string
  apiUrl?: string
  defaultSendEmail: boolean
  defaultLanguage: string
}): Promise<InvoiceActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const key = input.agentKey.trim()
  if (!key) {
    return { ok: false, message: 'A Számla Agent kulcs kötelező.' }
  }

  await getOrCreateInvoiceSettings(ctx.supabase, ctx.user.tenantId!)

  const { error } = await ctx.supabase
    .from('tenant_invoice_settings')
    .update({
      agent_key: key,
      api_url: input.apiUrl?.trim() || null,
      default_send_email: input.defaultSendEmail,
      default_language: input.defaultLanguage || 'hu',
      updated_at: new Date().toISOString()
    })
    .eq('tenant_id', ctx.user.tenantId!)

  if (error) {
    console.error('saveInvoiceSettingsAction', error.message)
    return { ok: false, message: 'Nem sikerült menteni a beállításokat.' }
  }

  revalidatePath('/beallitasok/szamlazas')
  return { ok: true, message: 'Beállítások mentve.' }
}

export async function testInvoiceConnectionAction(): Promise<InvoiceActionResult> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const settings = await getOrCreateInvoiceSettings(supabase, user.tenantId)
  if (!settings.agent_key?.trim()) {
    return { ok: false, message: 'Előbb mentsd el az Agent kulcsot.' }
  }

  const result = await testSzamlazzAgentConnection(
    settings.agent_key,
    settings.api_url
  )
  if (!result.ok) {
    return { ok: false, message: result.error || 'Kapcsolat sikertelen.' }
  }
  return { ok: true, message: 'A Számlázz.hu kapcsolat rendben van.' }
}

export async function createSaleInvoiceAction(input: {
  saleId: string
  kind: InvoiceIssueKind
  paymentMethod: InvoicePaymentMethod
  dueDate: string
  fulfillmentDate: string
  comment?: string
  sendEmail?: boolean
  markAsPaid?: boolean
  advanceAmount?: number
  proformaAmount?: number
  customerEmail?: string
}): Promise<InvoiceActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const result = await issueInvoiceFromSale(
    ctx.supabase,
    ctx.user.tenantId!,
    ctx.user.id ?? null,
    input
  )
  if (!result.ok) return result

  revalidateInvoicePaths({ saleId: input.saleId, invoiceId: result.invoiceId })
  return {
    ok: true,
    invoiceId: result.invoiceId,
    providerNumber: result.providerNumber,
    message: `Kiállítva: ${result.providerNumber}`
  }
}

export async function previewSaleInvoiceAction(input: {
  saleId: string
  kind: InvoiceIssueKind
  paymentMethod: InvoicePaymentMethod
  dueDate: string
  fulfillmentDate: string
  comment?: string
  advanceAmount?: number
  proformaAmount?: number
  customerEmail?: string
}): Promise<
  { ok: true; pdfBase64: string } | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  return previewSaleInvoice(ctx.supabase, ctx.user.tenantId!, {
    ...input,
    sendEmail: false,
    markAsPaid: false
  })
}

export async function createQuoteInvoiceAction(input: {
  quoteId: string
  kind: InvoiceIssueKind
  paymentMethod: InvoicePaymentMethod
  dueDate: string
  fulfillmentDate: string
  comment?: string
  sendEmail?: boolean
  markAsPaid?: boolean
  advanceAmount?: number
  proformaAmount?: number
  customerEmail?: string
  detailLevel?: QuoteInvoiceDetailLevel
}): Promise<InvoiceActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const result = await issueInvoiceFromQuote(
    ctx.supabase,
    ctx.user.tenantId!,
    ctx.user.id ?? null,
    input
  )
  if (!result.ok) return result

  revalidateInvoicePaths({
    quoteId: input.quoteId,
    invoiceId: result.invoiceId
  })
  return {
    ok: true,
    invoiceId: result.invoiceId,
    providerNumber: result.providerNumber,
    message: `Kiállítva: ${result.providerNumber}`
  }
}

export async function previewQuoteInvoiceAction(input: {
  quoteId: string
  kind: InvoiceIssueKind
  paymentMethod: InvoicePaymentMethod
  dueDate: string
  fulfillmentDate: string
  comment?: string
  advanceAmount?: number
  proformaAmount?: number
  customerEmail?: string
  detailLevel?: QuoteInvoiceDetailLevel
}): Promise<
  { ok: true; pdfBase64: string } | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  return previewQuoteInvoice(ctx.supabase, ctx.user.tenantId!, {
    ...input,
    sendEmail: false,
    markAsPaid: false
  })
}

export async function stornoInvoiceAction(
  invoiceId: string
): Promise<InvoiceActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data: before } = await ctx.supabase
    .from('invoices')
    .select('related_source_type, related_source_id')
    .eq('id', invoiceId)
    .eq('tenant_id', ctx.user.tenantId!)
    .maybeSingle()

  const result = await stornoInvoice(
    ctx.supabase,
    ctx.user.tenantId!,
    ctx.user.id ?? null,
    invoiceId
  )
  if (!result.ok) return result

  const saleId =
    before?.related_source_type === 'sale'
      ? (before.related_source_id ?? undefined)
      : undefined
  const quoteId =
    before?.related_source_type === 'opti_order'
      ? (before.related_source_id ?? undefined)
      : undefined
  revalidateInvoicePaths({
    saleId,
    quoteId,
    invoiceId: result.invoiceId
  })
  return {
    ok: true,
    invoiceId: result.invoiceId,
    providerNumber: result.providerNumber,
    message: `Sztornó: ${result.providerNumber}`
  }
}

/** Base64 PDF a kliens letöltéshez (kis fájlok). */
export async function fetchInvoicePdfAction(
  invoiceId: string
): Promise<
  | { ok: true; base64: string; filename: string }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const result = await getInvoicePdfBuffer(supabase, user.tenantId, invoiceId)
  if (!result.ok) return result

  const bytes = new Uint8Array(result.pdf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  const base64 = btoa(binary)
  return { ok: true, base64, filename: result.filename }
}

export async function queryTaxpayerAction(
  taxNumber: string
): Promise<
  | { ok: true; taxpayer: TaxpayerLookupResult }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const clean = taxNumber.trim().replace(/\s+/g, '')
  if (!HU_TAX_NUMBER_RE.test(clean)) {
    return {
      ok: false,
      message: 'Érvényes adószám kell (pl. 12345678-1-02).'
    }
  }

  let settings
  try {
    settings = await getOrCreateInvoiceSettings(supabase, user.tenantId)
  } catch {
    return {
      ok: false,
      message:
        'Nincs számlázási beállítás. Állítsd be: Beállítások → Számlázás.'
    }
  }

  if (!hasAgentKey(settings)) {
    return {
      ok: false,
      message:
        'Nincs Számlázz Agent kulcs. Állítsd be: Beállítások → Számlázás.'
    }
  }

  const result = await queryTaxpayerByTaxNumber({
    agentKey: settings.agent_key!.trim(),
    apiUrl: settings.api_url,
    taxNumber: clean
  })
  if (!result.ok) return { ok: false, message: result.error }
  return { ok: true, taxpayer: result.taxpayer }
}

