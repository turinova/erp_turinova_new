'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/auth/session'
import {
  searchProductsForSale,
  type SaleProductSearchItem
} from '@/lib/sales/queries'
import {
  assignSaleCustomerSchema,
  recordSalePaymentSchema,
  saleFormSchema,
  saleReturnFormSchema,
  updateSaleBillingSchema,
  updateSaleNoteSchema,
  updateSalePaymentSchema,
  voidSalePaymentSchema,
  type AssignSaleCustomerInput,
  type RecordSalePaymentInput,
  type SaleFormInput,
  type SaleReturnFormInput,
  type UpdateSaleBillingInput,
  type UpdateSaleNoteInput,
  type UpdateSalePaymentInput,
  type VoidSalePaymentInput
} from '@/lib/sales/parse'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type SaleActionResult =
  | { ok: true; id: string; saleNumber?: string; returnNumber?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/ertekesitesek'
const MOVEMENTS_PATH = '/keszlet/mozgasok'

function revalidateSalePaths(id?: string) {
  revalidatePath(LIST_PATH)
  revalidatePath(MOVEMENTS_PATH)
  if (id) revalidatePath(`${LIST_PATH}/${id}`)
  revalidatePath('/torzsadatok/alapanyagok/termekek')
}

export async function searchSaleProductsAction(
  q: string,
  warehouseId: string,
  opts?:
    | boolean
    | {
        inStockOnly?: boolean
        stockFirst?: boolean
        limit?: number
        kind?: 'all' | 'product' | 'sheet_material' | 'linear_material'
        includeMaterials?: boolean
      }
): Promise<
  | { ok: true; rows: SaleProductSearchItem[] }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }
  if (!warehouseId) {
    return { ok: false, message: 'Válaszd ki a raktárat.' }
  }

  const normalized =
    typeof opts === 'boolean'
      ? { inStockOnly: opts, stockFirst: true as const }
      : {
          inStockOnly: opts?.inStockOnly ?? false,
          stockFirst: opts?.stockFirst !== false,
          limit: opts?.limit,
          kind: opts?.kind,
          includeMaterials: opts?.includeMaterials
        }

  let includeMaterials = normalized.includeMaterials === true
  if (includeMaterials || normalized.kind === 'sheet_material' || normalized.kind === 'linear_material') {
    const { tenantHasLapszabaszat } = await import(
      '@/lib/lapszabaszat/entitlement'
    )
    includeMaterials = await tenantHasLapszabaszat(supabase, user.tenantId)
    if (
      !includeMaterials &&
      (normalized.kind === 'sheet_material' ||
        normalized.kind === 'linear_material')
    ) {
      return { ok: true, rows: [] }
    }
  }

  try {
    const rows = await searchProductsForSale(
      supabase,
      user.tenantId,
      q,
      warehouseId,
      { ...normalized, includeMaterials }
    )
    return { ok: true, rows }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'Nem sikerült keresni a termékeket.'
    }
  }
}

export async function createSaleAction(
  input: SaleFormInput
): Promise<SaleActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = saleFormSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form'
      if (!fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.',
      fieldErrors
    }
  }

  const d = parsed.data
  const items = d.items.map((it) => {
    const kind = it.kind ?? 'product'
    if (kind === 'sheet_material') {
      return {
        line_kind: 'sheet_material',
        sheet_material_id: it.sheetMaterialId,
        quantity: it.quantity,
        unit_price_gross: it.unitPriceGross,
        discount_percentage: it.discountPercentage ?? 0,
        discount_amount: it.discountAmount ?? 0
      }
    }
    if (kind === 'linear_material') {
      return {
        line_kind: 'linear_material',
        linear_material_id: it.linearMaterialId,
        quantity: it.quantity,
        unit_price_gross: it.unitPriceGross,
        discount_percentage: it.discountPercentage ?? 0,
        discount_amount: it.discountAmount ?? 0
      }
    }
    return {
      line_kind: 'product',
      accessory_id: it.accessoryId,
      quantity: it.quantity,
      unit_price_gross: it.unitPriceGross,
      discount_percentage: it.discountPercentage ?? 0,
      discount_amount: it.discountAmount ?? 0
    }
  })

  const fees = (d.fees ?? []).map((f) => ({
    fee_type_id: f.feeTypeId ?? null,
    name: f.name,
    quantity: f.quantity,
    unit_price_gross: f.unitPriceGross,
    tax_rate_percent: f.taxRatePercent ?? 27
  }))

  const payments = d.payments.map((p) => ({
    payment_method_id: p.paymentMethodId,
    amount: p.amount,
    provider_ref: p.providerRef?.trim() || null
  }))

  // Vendég: nincs hitel (üres payments). Partial due-t a create_sale SQL ellenőrzi.
  if (!d.customerId && payments.length === 0) {
    return {
      ok: false,
      message:
        'Vendégnél csak teljes fizetés engedélyezett. Részfizetéshez vagy hitelhez válassz vevőt.'
    }
  }

  const { data, error } = await ctx.supabase.rpc('create_sale', {
    p_warehouse_id: d.warehouseId,
    p_customer_id: d.customerId ?? null,
    p_channel: d.channel ?? 'manual',
    p_note: d.note ?? null,
    p_items: items,
    p_fees: fees,
    p_discount: {
      percentage: d.discountPercentage ?? 0,
      amount: d.discountAmount ?? 0
    },
    p_payments: payments,
    p_pos_register_id: d.posRegisterId ?? null,
    p_fulfill_now: payments.length === 0 ? Boolean(d.fulfillNow) : false
  })

  if (error) {
    console.error('createSaleAction', error.message)
    return { ok: false, message: 'Nem sikerült rögzíteni az értékesítést.' }
  }

  const result = data as {
    ok?: boolean
    id?: string
    sale_number?: string
    message?: string
  } | null

  if (!result?.ok || !result.id) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült rögzíteni az értékesítést.'
    }
  }

  // Doksi billing felülírás (törzs default után) — ne piszkálja az ügyfelet
  const b = d.billing
  if (
    b &&
    (b.billingName ||
      b.billingCity ||
      b.billingStreet ||
      b.billingTaxNumber ||
      b.billingPostalCode ||
      b.billingHouseNumber)
  ) {
    const { error: billErr } = await ctx.supabase
      .from('sales_orders')
      .update({
        billing_name_snapshot: b.billingName ?? null,
        billing_country_snapshot: b.billingCountry || 'Magyarország',
        billing_city_snapshot: b.billingCity ?? null,
        billing_postal_code_snapshot: b.billingPostalCode ?? null,
        billing_street_snapshot: b.billingStreet ?? null,
        billing_house_number_snapshot: b.billingHouseNumber ?? null,
        billing_tax_number_snapshot: b.billingTaxNumber ?? null
      })
      .eq('id', result.id)
      .eq('tenant_id', ctx.user.tenantId!)

    if (billErr) {
      console.error('createSaleAction billing override', billErr.message)
    }
  }

  revalidateSalePaths(result.id)
  for (const it of d.items) {
    if (it.kind === 'product' && it.accessoryId) {
      revalidatePath(`/torzsadatok/alapanyagok/termekek/${it.accessoryId}`)
    } else if (it.kind === 'sheet_material' && it.sheetMaterialId) {
      revalidatePath(
        `/torzsadatok/alapanyagok/tablas-anyagok/${it.sheetMaterialId}`
      )
    } else if (it.kind === 'linear_material' && it.linearMaterialId) {
      revalidatePath(
        `/torzsadatok/alapanyagok/szalas-anyagok/${it.linearMaterialId}`
      )
    }
  }

  return {
    ok: true,
    id: result.id,
    saleNumber: result.sale_number
  }
}

export async function createSaleReturnAction(
  input: SaleReturnFormInput
): Promise<SaleActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = saleReturnFormSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.'
    }
  }

  const d = parsed.data
  const { data, error } = await ctx.supabase.rpc('create_sale_return', {
    p_sales_order_id: d.salesOrderId,
    p_items: d.items.map((it) => ({
      sales_order_item_id: it.salesOrderItemId,
      quantity: it.quantity,
      restock: it.restock
    })),
    p_payment_method_id: d.paymentMethodId ?? null,
    p_note: d.note ?? null,
    p_reason: d.reason ?? null
  })

  if (error) {
    console.error('createSaleReturnAction', error.message)
    return { ok: false, message: 'Nem sikerült rögzíteni a visszárut.' }
  }

  const result = data as {
    ok?: boolean
    id?: string
    return_number?: string
    sales_order_id?: string
    message?: string
  } | null

  if (!result?.ok || !result.id) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült rögzíteni a visszárut.'
    }
  }

  const saleId = result.sales_order_id ?? d.salesOrderId
  revalidateSalePaths(saleId)

  return {
    ok: true,
    id: result.id,
    returnNumber: result.return_number
  }
}

export async function recordSalePaymentAction(
  input: RecordSalePaymentInput
): Promise<SaleActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = recordSalePaymentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.'
    }
  }

  const d = parsed.data
  const { data, error } = await ctx.supabase.rpc('record_sale_payment', {
    p_sales_order_id: d.salesOrderId,
    p_payment_method_id: d.paymentMethodId,
    p_amount: d.amount
  })

  if (error) {
    console.error('recordSalePaymentAction', error.message)
    return { ok: false, message: 'Nem sikerült rögzíteni a fizetést.' }
  }

  const result = data as {
    ok?: boolean
    id?: string
    payment_status?: string
    message?: string
  } | null

  if (!result?.ok || !result.id) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült rögzíteni a fizetést.'
    }
  }

  revalidateSalePaths(result.id)
  return { ok: true, id: result.id }
}

export async function updateSalePaymentAction(
  input: UpdateSalePaymentInput
): Promise<SaleActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = updateSalePaymentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.'
    }
  }

  const d = parsed.data
  const { data, error } = await ctx.supabase.rpc('update_sale_payment', {
    p_payment_id: d.paymentId,
    p_payment_method_id: d.paymentMethodId,
    p_amount: d.amount,
    p_note: d.note
  })

  if (error) {
    console.error('updateSalePaymentAction', error.message)
    return { ok: false, message: 'Nem sikerült módosítani a fizetést.' }
  }

  const result = data as {
    ok?: boolean
    id?: string
    message?: string
  } | null

  if (!result?.ok || !result.id) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült módosítani a fizetést.'
    }
  }

  revalidateSalePaths(result.id)
  return { ok: true, id: result.id }
}

export async function voidSalePaymentAction(
  input: VoidSalePaymentInput
): Promise<SaleActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = voidSalePaymentSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.'
    }
  }

  const { data, error } = await ctx.supabase.rpc('void_sale_payment', {
    p_payment_id: parsed.data.paymentId,
    p_note: parsed.data.note
  })

  if (error) {
    console.error('voidSalePaymentAction', error.message)
    return { ok: false, message: 'Nem sikerült érvényteleníteni a fizetést.' }
  }

  const result = data as {
    ok?: boolean
    id?: string
    message?: string
  } | null

  if (!result?.ok || !result.id) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült érvényteleníteni a fizetést.'
    }
  }

  revalidateSalePaths(result.id)
  return { ok: true, id: result.id }
}

/** Confirmed → fulfilled + stock out (áru átadása). */
export async function fulfillSaleAction(
  salesOrderId: string
): Promise<SaleActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (!salesOrderId) {
    return { ok: false, message: 'Hiányzó eladás azonosító.' }
  }

  const { data, error } = await ctx.supabase.rpc('fulfill_sale', {
    p_sales_order_id: salesOrderId
  })

  if (error) {
    console.error('fulfillSaleAction', error.message)
    return { ok: false, message: 'Nem sikerült teljesíteni az eladást.' }
  }

  const result = data as {
    ok?: boolean
    id?: string
    sale_number?: string
    message?: string
  } | null

  if (!result?.ok || !result.id) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült teljesíteni az eladást.'
    }
  }

  revalidateSalePaths(result.id)
  return { ok: true, id: result.id, saleNumber: result.sale_number }
}

/** Detail: belső megjegyzés (számla után is engedett). */
export async function updateSaleNoteAction(
  input: UpdateSaleNoteInput
): Promise<SaleActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = updateSaleNoteSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.'
    }
  }

  const { salesOrderId, note } = parsed.data
  const tenantId = ctx.user.tenantId!
  const cleaned = note?.trim() ? note.trim() : null

  const { data: sale, error: saleErr } = await ctx.supabase
    .from('sales_orders')
    .select('id, deleted_at')
    .eq('id', salesOrderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (saleErr || !sale || sale.deleted_at) {
    return { ok: false, message: 'Az eladás nem található.' }
  }

  const { error } = await ctx.supabase
    .from('sales_orders')
    .update({
      note: cleaned,
      updated_at: new Date().toISOString()
    })
    .eq('id', salesOrderId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('updateSaleNoteAction', error.message)
    return { ok: false, message: 'Nem sikerült menteni a megjegyzést.' }
  }

  revalidateSalePaths(salesOrderId)
  return { ok: true, id: salesOrderId }
}

/** Detail: számlázási snapshot szerkesztés (amíg nincs aktív végszámla). */
export async function updateSaleBillingAction(
  input: UpdateSaleBillingInput
): Promise<SaleActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = updateSaleBillingSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.'
    }
  }

  const { salesOrderId, billing: b } = parsed.data
  const tenantId = ctx.user.tenantId!

  const { data: sale, error: saleErr } = await ctx.supabase
    .from('sales_orders')
    .select('id, status, deleted_at')
    .eq('id', salesOrderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (saleErr || !sale || sale.deleted_at) {
    return { ok: false, message: 'Az eladás nem található.' }
  }
  if (sale.status === 'cancelled') {
    return { ok: false, message: 'Törölt eladáson nem módosítható a számlázás.' }
  }

  const { data: invoices } = await ctx.supabase
    .from('invoices')
    .select('id, invoice_type, is_storno_of_invoice_id')
    .eq('tenant_id', tenantId)
    .eq('related_source_type', 'sale')
    .eq('related_source_id', salesOrderId)
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

  const { error } = await ctx.supabase
    .from('sales_orders')
    .update({
      billing_name_snapshot: b.billingName.trim(),
      billing_country_snapshot: b.billingCountry?.trim() || 'Magyarország',
      billing_city_snapshot: b.billingCity?.trim() || null,
      billing_postal_code_snapshot: b.billingPostalCode?.trim() || null,
      billing_street_snapshot: b.billingStreet?.trim() || null,
      billing_house_number_snapshot: b.billingHouseNumber?.trim() || null,
      billing_tax_number_snapshot: b.billingTaxNumber?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', salesOrderId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('updateSaleBillingAction', error.message)
    return { ok: false, message: 'Nem sikerült menteni a számlázási adatokat.' }
  }

  revalidateSalePaths(salesOrderId)
  revalidatePath('/szamlak')
  return { ok: true, id: salesOrderId }
}

/** Meglévő eladáshoz ügyfél rendelése / cseréje (+ opcionális billing snapshot). */
export async function assignSaleCustomerAction(
  input: AssignSaleCustomerInput
): Promise<SaleActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = assignSaleCustomerSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Hibás adatok.'
    }
  }

  const { salesOrderId, customerId, pullBilling } = parsed.data
  const tenantId = ctx.user.tenantId!

  const { data: sale, error: saleErr } = await ctx.supabase
    .from('sales_orders')
    .select('id, status, deleted_at')
    .eq('id', salesOrderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (saleErr || !sale || sale.deleted_at) {
    return { ok: false, message: 'Az eladás nem található.' }
  }
  if (sale.status === 'cancelled') {
    return { ok: false, message: 'Törölt eladáson nem módosítható az ügyfél.' }
  }

  const { data: invoices } = await ctx.supabase
    .from('invoices')
    .select('id, invoice_type, is_storno_of_invoice_id')
    .eq('tenant_id', tenantId)
    .eq('related_source_type', 'sale')
    .eq('related_source_id', salesOrderId)
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
        'Aktív számla mellett az ügyfél nem módosítható. Előbb sztornózd a számlát.'
    }
  }

  // Vendég: ügyfél link + név/kontakt snapshot törlése (billing megmarad)
  if (!customerId) {
    const { error } = await ctx.supabase
      .from('sales_orders')
      .update({
        customer_id: null,
        customer_name_snapshot: null,
        customer_email_snapshot: null,
        customer_mobile_snapshot: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', salesOrderId)
      .eq('tenant_id', tenantId)

    if (error) {
      console.error('assignSaleCustomerAction guest', error.message)
      return { ok: false, message: 'Nem sikerült vendégre állítani.' }
    }

    revalidateSalePaths(salesOrderId)
    revalidatePath('/szamlak')
    return { ok: true, id: salesOrderId }
  }

  const { data: customer, error: custErr } = await ctx.supabase
    .from('customers')
    .select(
      `
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
    `
    )
    .eq('id', customerId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (custErr || !customer) {
    return { ok: false, message: 'Az ügyfél nem található.' }
  }

  const patch: Record<string, string | null> = {
    customer_id: customer.id,
    customer_name_snapshot: customer.name,
    customer_email_snapshot: customer.email,
    customer_mobile_snapshot: customer.mobile,
    updated_at: new Date().toISOString()
  }

  if (pullBilling) {
    patch.billing_name_snapshot =
      customer.billing_name?.trim() || customer.name
    patch.billing_country_snapshot =
      customer.billing_country?.trim() || 'Magyarország'
    patch.billing_city_snapshot = customer.billing_city
    patch.billing_postal_code_snapshot = customer.billing_postal_code
    patch.billing_street_snapshot = customer.billing_street
    patch.billing_house_number_snapshot = customer.billing_house_number
    patch.billing_tax_number_snapshot = customer.billing_tax_number
  }

  const { error } = await ctx.supabase
    .from('sales_orders')
    .update(patch)
    .eq('id', salesOrderId)
    .eq('tenant_id', tenantId)

  if (error) {
    console.error('assignSaleCustomerAction', error.message)
    return { ok: false, message: 'Nem sikerült az ügyfelet hozzárendelni.' }
  }

  revalidateSalePaths(salesOrderId)
  revalidatePath(`/ugyfelek/${customer.id}`)
  revalidatePath('/szamlak')
  return { ok: true, id: salesOrderId }
}

export type SaleReturnSearchHit = {
  id: string
  sale_number: string
  customer_name: string | null
  total_gross: number
  status: string
  fulfilled_at: string | null
}

/** POS / visszáru: eladás kereső (szám vagy ügyfél). */
export async function searchSalesForReturnAction(
  q: string
): Promise<
  | { ok: true; rows: SaleReturnSearchHit[] }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs munkamenet.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Nincs adatbázis kapcsolat.' }

  const safe = q.trim().replace(/[%_,]/g, '')
  if (safe.length < 1) return { ok: true, rows: [] }

  const { data, error } = await supabase
    .from('sales_orders')
    .select(
      'id, sale_number, customer_name_snapshot, total_gross, status, fulfilled_at'
    )
    .eq('tenant_id', user.tenantId)
    .is('deleted_at', null)
    .in('status', ['fulfilled', 'partially_returned'])
    .or(
      `sale_number.ilike.%${safe}%,customer_name_snapshot.ilike.%${safe}%`
    )
    .order('created_at', { ascending: false })
    .limit(15)

  if (error) {
    console.error('searchSalesForReturnAction', error.message)
    return { ok: false, message: 'Nem sikerült keresni az eladásokat.' }
  }

  return {
    ok: true,
    rows: (data ?? []).map((r) => ({
      id: r.id,
      sale_number: r.sale_number,
      customer_name: r.customer_name_snapshot,
      total_gross: Number(r.total_gross),
      status: r.status,
      fulfilled_at: r.fulfilled_at
    }))
  }
}
