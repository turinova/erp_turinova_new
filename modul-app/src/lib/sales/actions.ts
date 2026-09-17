'use server'

import { revalidatePath } from 'next/cache'

import { getSessionUser } from '@/lib/auth/session'
import {
  searchProductsForSale,
  type SaleProductSearchItem
} from '@/lib/sales/queries'
import { saleFormSchema, type SaleFormInput } from '@/lib/sales/parse'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type SaleActionResult =
  | { ok: true; id: string; saleNumber?: string }
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
    p_payments: payments
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
