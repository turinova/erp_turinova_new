'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  mergeItemsByAccessory,
  purchaseOrderFormSchema,
  type PurchaseOrderFormInput,
  type PurchaseOrderFormValues
} from '@/lib/purchase-orders/parse'
import { searchProductsForPurchaseOrder } from '@/lib/purchase-orders/queries'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { ensureDefaultWarehouse } from '@/lib/warehouses/queries'

export type PurchaseOrderActionResult =
  | { ok: true; id: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/beszallitoi-rendelesek'

function revalidatePoPaths(id?: string) {
  revalidatePath(LIST_PATH)
  if (id) revalidatePath(`${LIST_PATH}/${id}`)
  revalidatePath(`${LIST_PATH}/uj`)
}

function mapDbError(message: string): string | null {
  if (
    message.includes('purchase_orders_tenant_number_alive') ||
    message.includes('duplicate key')
  ) {
    return 'A rendelésszám már foglalt — próbáld újra.'
  }
  if (message.includes('purchase_order_items_po_accessory')) {
    return 'Ugyanaz a termék kétszer szerepel — egyesítsd a mennyiségeket.'
  }
  if (message.includes('suppliers') && message.includes('foreign')) {
    return 'A beszállító nem található vagy inaktív.'
  }
  return null
}

function fieldErrorsFromZod(
  issues: { path: (string | number)[]; message: string }[]
) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
    const root = issue.path[0]
    if (typeof root === 'string' && !fieldErrors[root]) {
      fieldErrors[root] = issue.message
    }
  }
  return fieldErrors
}

async function assertActiveSupplier(
  supabase: SupabaseClient,
  tenantId: string,
  supplierId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('id', supplierId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error || !data) return 'A beszállító nem található.'
  if (data.status !== 'active') {
    return 'Inaktív beszállítóra nem nyitható rendelés.'
  }
  return null
}

async function resolveWarehouseId(
  supabase: SupabaseClient,
  tenantId: string,
  warehouseId: string | undefined
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (warehouseId) {
    const { data, error } = await supabase
      .from('warehouses')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('id', warehouseId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .maybeSingle()

    if (error || !data) {
      return {
        ok: false,
        message: 'A célraktár nem található vagy inaktív.'
      }
    }
    return { ok: true, id: data.id }
  }

  try {
    const warehouse = await ensureDefaultWarehouse(supabase, tenantId)
    return { ok: true, id: warehouse.id }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült meghatározni a célraktárat.'
    }
  }
}

function itemRows(
  tenantId: string,
  poId: string,
  items: PurchaseOrderFormValues['items']
) {
  return items.map((it, index) => ({
    tenant_id: tenantId,
    purchase_order_id: poId,
    accessory_id: it.accessoryId,
    name_snapshot: it.nameSnapshot,
    sku_snapshot: it.skuSnapshot,
    quantity: it.quantity,
    net_price: it.netPrice,
    tax_rate_id: it.taxRateId,
    tax_rate_percent: it.taxRatePercent,
    unit_id: it.unitId,
    unit_shortform: it.unitShortform,
    sort_order: index
  }))
}

export async function createPurchaseOrder(
  input: PurchaseOrderFormInput
): Promise<PurchaseOrderActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const merged = {
    ...input,
    items: mergeItemsByAccessory(input.items)
  }
  const parsed = purchaseOrderFormSchema.safeParse(merged)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const tenantId = ctx.user.tenantId!
  const supplierErr = await assertActiveSupplier(
    ctx.supabase,
    tenantId,
    parsed.data.supplierId
  )
  if (supplierErr) {
    return { ok: false, message: supplierErr, fieldErrors: { supplierId: supplierErr } }
  }

  const warehouseRes = await resolveWarehouseId(
    ctx.supabase,
    tenantId,
    parsed.data.warehouseId
  )
  if (!warehouseRes.ok) {
    return {
      ok: false,
      message: warehouseRes.message,
      fieldErrors: { warehouseId: warehouseRes.message }
    }
  }
  const warehouseId = warehouseRes.id

  const { data: poNumber, error: numErr } = await ctx.supabase.rpc(
    'generate_purchase_order_number',
    { p_tenant_id: tenantId }
  )
  if (numErr || !poNumber) {
    return {
      ok: false,
      message: 'Nem sikerült rendelésszámot generálni.'
    }
  }

  const { data: po, error } = await ctx.supabase
    .from('purchase_orders')
    .insert({
      tenant_id: tenantId,
      supplier_id: parsed.data.supplierId,
      warehouse_id: warehouseId,
      po_number: poNumber as string,
      status: 'draft',
      expected_date: parsed.data.expectedDate,
      note: parsed.data.note,
      currency: parsed.data.currency
    })
    .select('id')
    .single()

  if (error || !po) {
    const mapped = error ? mapDbError(error.message) : null
    return {
      ok: false,
      message: mapped ?? 'Nem sikerült létrehozni a rendelést.'
    }
  }

  const { error: itemsErr } = await ctx.supabase
    .from('purchase_order_items')
    .insert(itemRows(tenantId, po.id, parsed.data.items))

  if (itemsErr) {
    await ctx.supabase.from('purchase_orders').delete().eq('id', po.id)
    const mapped = mapDbError(itemsErr.message)
    return {
      ok: false,
      message: mapped ?? 'Nem sikerült menteni a tételeket.'
    }
  }

  revalidatePoPaths(po.id)
  return { ok: true, id: po.id }
}

export async function updatePurchaseOrder(
  input: PurchaseOrderFormInput & { id: string }
): Promise<PurchaseOrderActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const merged = {
    ...input,
    items: mergeItemsByAccessory(input.items)
  }
  const parsed = purchaseOrderFormSchema.safeParse(merged)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a megadott adatokat.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const tenantId = ctx.user.tenantId!

  const { data: existing, error: loadErr } = await ctx.supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', input.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !existing) {
    return { ok: false, message: 'A rendelés nem található.' }
  }
  if (existing.status !== 'draft') {
    return {
      ok: false,
      message: 'Csak vázlat státuszú rendelés szerkeszthető.'
    }
  }

  const supplierErr = await assertActiveSupplier(
    ctx.supabase,
    tenantId,
    parsed.data.supplierId
  )
  if (supplierErr) {
    return { ok: false, message: supplierErr, fieldErrors: { supplierId: supplierErr } }
  }

  const warehouseRes = await resolveWarehouseId(
    ctx.supabase,
    tenantId,
    parsed.data.warehouseId
  )
  if (!warehouseRes.ok) {
    return {
      ok: false,
      message: warehouseRes.message,
      fieldErrors: { warehouseId: warehouseRes.message }
    }
  }

  const { error: updErr } = await ctx.supabase
    .from('purchase_orders')
    .update({
      supplier_id: parsed.data.supplierId,
      warehouse_id: warehouseRes.id,
      expected_date: parsed.data.expectedDate,
      note: parsed.data.note,
      currency: parsed.data.currency,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .eq('tenant_id', tenantId)

  if (updErr) {
    return { ok: false, message: 'Nem sikerült menteni a rendelést.' }
  }

  await ctx.supabase
    .from('purchase_order_items')
    .delete()
    .eq('purchase_order_id', input.id)

  const { error: itemsErr } = await ctx.supabase
    .from('purchase_order_items')
    .insert(itemRows(tenantId, input.id, parsed.data.items))

  if (itemsErr) {
    const mapped = mapDbError(itemsErr.message)
    return {
      ok: false,
      message: mapped ?? 'Nem sikerült menteni a tételeket.'
    }
  }

  revalidatePoPaths(input.id)
  return { ok: true, id: input.id }
}

export async function markPurchaseOrderOrdered(
  id: string
): Promise<PurchaseOrderActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const { data: existing, error: loadErr } = await ctx.supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !existing) {
    return { ok: false, message: 'A rendelés nem található.' }
  }
  if (existing.status === 'ordered') {
    revalidatePoPaths(id)
    return { ok: true, id }
  }
  if (existing.status !== 'draft') {
    return {
      ok: false,
      message: 'Csak vázlat rendelés jelölhető megrendelve.'
    }
  }

  const { count, error: countErr } = await ctx.supabase
    .from('purchase_order_items')
    .select('id', { count: 'exact', head: true })
    .eq('purchase_order_id', id)
    .is('deleted_at', null)

  if (countErr || !count || count < 1) {
    return { ok: false, message: 'Legalább egy tétel kell a megrendeléshez.' }
  }

  const { error } = await ctx.supabase
    .from('purchase_orders')
    .update({
      status: 'ordered',
      ordered_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .eq('status', 'draft')

  if (error) {
    return { ok: false, message: 'Nem sikerült megrendelésnek jelölni.' }
  }

  revalidatePoPaths(id)
  return { ok: true, id }
}

export async function cancelPurchaseOrder(
  id: string
): Promise<PurchaseOrderActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const { data: existing, error: loadErr } = await ctx.supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !existing) {
    return { ok: false, message: 'A rendelés nem található.' }
  }
  if (!['draft', 'ordered'].includes(existing.status)) {
    return {
      ok: false,
      message: 'Csak vázlat vagy megrendelt (még nem beérkezett) rendelés törölhető.'
    }
  }

  if (existing.status === 'draft') {
    const { error } = await ctx.supabase
      .from('purchase_orders')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) {
      return { ok: false, message: 'Nem sikerült törölni a rendelést.' }
    }
  } else {
    const { error } = await ctx.supabase
      .from('purchase_orders')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('tenant_id', tenantId)
    if (error) {
      return { ok: false, message: 'Nem sikerült visszavonni a rendelést.' }
    }
  }

  revalidatePoPaths(id)
  return { ok: true, id }
}

/** Hiányos lezárás: többet nem várunk → PO = Beérkezett. */
export async function closePurchaseOrderIncomplete(
  id: string
): Promise<PurchaseOrderActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const { data: existing, error: loadErr } = await ctx.supabase
    .from('purchase_orders')
    .select('id, status')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !existing) {
    return { ok: false, message: 'A rendelés nem található.' }
  }

  if (existing.status === 'received') {
    revalidatePoPaths(id)
    return { ok: true, id }
  }

  if (existing.status !== 'ordered' && existing.status !== 'partial') {
    return {
      ok: false,
      message:
        'Csak megrendelt vagy részben beérkezett rendelés zárható le hiányosan.'
    }
  }

  const { data: checking } = await ctx.supabase
    .from('goods_receipts')
    .select('id, receipt_number')
    .eq('purchase_order_id', id)
    .eq('tenant_id', tenantId)
    .eq('status', 'checking')
    .is('deleted_at', null)
    .maybeSingle()

  if (checking) {
    return {
      ok: false,
      message: `Előbb fejezd be vagy töröld a nyitott beérkezést (${checking.receipt_number}).`
    }
  }

  const {
    data: { user }
  } = await ctx.supabase.auth.getUser()

  const { error } = await ctx.supabase
    .from('purchase_orders')
    .update({
      status: 'received',
      closed_incomplete_at: new Date().toISOString(),
      closed_incomplete_by: user?.id ?? null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .in('status', ['ordered', 'partial'])

  if (error) {
    console.error('closePurchaseOrderIncomplete', error.message)
    return { ok: false, message: 'Nem sikerült lezárni a rendelést.' }
  }

  revalidatePoPaths(id)
  revalidatePath('/beerkezesek')
  return { ok: true, id }
}

export async function searchPurchaseProductsAction(
  q: string
): Promise<
  | { ok: true; rows: Awaited<ReturnType<typeof searchProductsForPurchaseOrder>> }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  try {
    const rows = await searchProductsForPurchaseOrder(
      ctx.supabase,
      ctx.user.tenantId!,
      q,
      15
    )
    return { ok: true, rows }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Nem sikerült keresni a termékek között.'
    }
  }
}
