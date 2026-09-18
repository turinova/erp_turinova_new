'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/auth/session'
import {
  searchProductsForSale,
  type SaleProductSearchItem
} from '@/lib/sales/queries'
import {
  saleFormSchema,
  saleReturnFormSchema,
  type SaleFormInput,
  type SaleReturnFormInput
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
  inStockOnly = false
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
  try {
    const rows = await searchProductsForSale(
      supabase,
      user.tenantId,
      q,
      warehouseId,
      { inStockOnly }
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
  const items = d.items.map((it) => ({
    accessory_id: it.accessoryId,
    quantity: it.quantity,
    unit_price_gross: it.unitPriceGross,
    discount_percentage: it.discountPercentage ?? 0,
    discount_amount: it.discountAmount ?? 0
  }))

  const fees = (d.fees ?? []).map((f) => ({
    fee_type_id: f.feeTypeId ?? null,
    name: f.name,
    quantity: f.quantity,
    unit_price_gross: f.unitPriceGross,
    tax_rate_percent: f.taxRatePercent ?? 27
  }))

  const payments = d.payments.map((p) => ({
    payment_method_id: p.paymentMethodId,
    amount: p.amount
  }))

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
    p_pos_register_id: d.posRegisterId ?? null
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
    revalidatePath(`/torzsadatok/alapanyagok/termekek/${it.accessoryId}`)
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
