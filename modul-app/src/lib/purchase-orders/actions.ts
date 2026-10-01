'use server'

import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js'

import { getSessionUser } from '@/lib/auth/session'
import { tenantHasLapszabaszat } from '@/lib/lapszabaszat/entitlement'
import {
  mergePurchaseOrderItems,
  purchaseOrderFormSchema,
  type PurchaseOrderFormInput,
  type PurchaseOrderFormValues,
  type PurchaseOrderItemInput,
  type PurchaseOrderKind
} from '@/lib/purchase-orders/parse'
import {
  searchLinearsForPurchaseOrder,
  searchProductsForPurchaseOrder,
  searchSheetsForPurchaseOrder
} from '@/lib/purchase-orders/queries'
import { createClient } from '@/lib/supabase/server'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import {
  getSupplierProcurementAids,
  mapAccessorySupplierSkus,
  type SupplierProcurementAids
} from '@/lib/suppliers/queries'
import { ensureDefaultWarehouse } from '@/lib/warehouses/queries'

const MATERIAL_PROCUREMENT_DENIED =
  'Anyag beszerzéshez Lapszabászat add-on kell.'

async function assertMaterialProcurementAllowed(
  supabase: SupabaseClient,
  tenantId: string,
  orderKind: PurchaseOrderKind
): Promise<string | null> {
  if (orderKind !== 'material') return null
  const ok = await tenantHasLapszabaszat(supabase, tenantId)
  return ok ? null : MATERIAL_PROCUREMENT_DENIED
}

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
  if (
    message.includes('purchase_order_items_po_sheet') ||
    message.includes('purchase_order_items_po_linear')
  ) {
    return 'Ugyanaz az anyag kétszer szerepel — egyesítsd a mennyiségeket.'
  }
  if (message.includes('purchase_order_items_line_fk')) {
    return 'Érvénytelen tétel típus — ellenőrizd a termék/anyag sort.'
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
  return items.map((it, index) => {
    const base = {
      tenant_id: tenantId,
      purchase_order_id: poId,
      line_kind: it.lineKind,
      name_snapshot: it.nameSnapshot,
      sku_snapshot: it.skuSnapshot,
      quantity: it.quantity,
      net_price: it.netPrice,
      tax_rate_id: it.taxRateId,
      tax_rate_percent: it.taxRatePercent,
      unit_shortform: it.unitShortform,
      sort_order: index,
      price_per_area_net: it.pricePerAreaNet ?? null,
      area_or_length_factor: it.areaOrLengthFactor ?? null
    }

    if (it.lineKind === 'accessory') {
      return {
        ...base,
        accessory_id: it.accessoryId,
        sheet_material_id: null,
        linear_material_id: null,
        unit_id: it.unitId
      }
    }
    if (it.lineKind === 'sheet_material') {
      return {
        ...base,
        accessory_id: null,
        sheet_material_id: it.sheetMaterialId,
        linear_material_id: null,
        unit_id: null
      }
    }
    return {
      ...base,
      accessory_id: null,
      sheet_material_id: null,
      linear_material_id: it.linearMaterialId,
      unit_id: null
    }
  })
}

export async function createPurchaseOrder(
  input: PurchaseOrderFormInput
): Promise<PurchaseOrderActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const merged = {
    ...input,
    items: mergePurchaseOrderItems(input.items)
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
  const materialGate = await assertMaterialProcurementAllowed(
    ctx.supabase,
    tenantId,
    parsed.data.orderKind
  )
  if (materialGate) {
    return {
      ok: false,
      message: materialGate,
      fieldErrors: { orderKind: materialGate }
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
      order_kind: parsed.data.orderKind,
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

/**
 * Tételek hozzáadása meglévő draft PO-hoz.
 * Azonos accessory → qty összeadás; új accessory → új sor.
 */
export async function appendItemsToDraftPurchaseOrder(input: {
  purchaseOrderId: string
  /** Ellenőrzés: a PO ehhez a beszállítóhoz tartozzon. */
  supplierId: string
  /** Ha megadott: a PO raktárának egyeznie kell. */
  warehouseId?: string
  items: PurchaseOrderItemInput[]
}): Promise<PurchaseOrderActionResult & { poNumber?: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const mergedItems = mergePurchaseOrderItems(input.items)
  if (!mergedItems.length) {
    return { ok: false, message: 'Nincs hozzáadandó tétel.' }
  }

  for (const it of mergedItems) {
    if (it.lineKind !== 'accessory') {
      return {
        ok: false,
        message: 'Vázlathoz csak termék tételek adhatók hozzá ezzel a funkcióval.'
      }
    }
  }

  const tenantId = ctx.user.tenantId!
  const { data: po, error: loadErr } = await ctx.supabase
    .from('purchase_orders')
    .select('id, status, supplier_id, warehouse_id, po_number, order_kind')
    .eq('id', input.purchaseOrderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !po) {
    return { ok: false, message: 'A beszállítói rendelés nem található.' }
  }
  if (po.status !== 'draft') {
    return {
      ok: false,
      message: 'Csak vázlat státuszú rendeléshez lehet tételt hozzáadni.'
    }
  }
  if ((po.order_kind as string | null) === 'material') {
    return {
      ok: false,
      message: 'Anyag rendeléshez nem adható termék tétel.'
    }
  }
  if (po.supplier_id !== input.supplierId) {
    return {
      ok: false,
      message: 'A vázlat más beszállítóhoz tartozik.'
    }
  }
  if (input.warehouseId && po.warehouse_id !== input.warehouseId) {
    return {
      ok: false,
      message: 'A vázlat más raktárhoz tartozik.'
    }
  }

  const { data: existingItems, error: itemsErr } = await ctx.supabase
    .from('purchase_order_items')
    .select(
      'id, accessory_id, quantity, sort_order, name_snapshot, sku_snapshot, net_price, tax_rate_id, tax_rate_percent, unit_id, unit_shortform'
    )
    .eq('purchase_order_id', po.id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (itemsErr) {
    return { ok: false, message: 'Nem sikerült betölteni a vázlat tételeit.' }
  }

  const byAccessory = new Map(
    (existingItems ?? [])
      .filter((row) => row.accessory_id)
      .map((row) => [row.accessory_id as string, row])
  )
  let maxSort = (existingItems ?? []).reduce(
    (m, r) => Math.max(m, Number(r.sort_order ?? 0)),
    -1
  )

  const toInsert: ReturnType<typeof itemRows> = []
  for (const it of mergedItems) {
    if (it.lineKind !== 'accessory') continue
    const prev = byAccessory.get(it.accessoryId)
    if (prev) {
      const nextQty = Number(prev.quantity) + it.quantity
      const { error: updErr } = await ctx.supabase
        .from('purchase_order_items')
        .update({
          quantity: nextQty,
          net_price: it.netPrice > 0 ? it.netPrice : prev.net_price,
          updated_at: new Date().toISOString()
        })
        .eq('id', prev.id)
        .eq('tenant_id', tenantId)
      if (updErr) {
        const mapped = mapDbError(updErr.message)
        return {
          ok: false,
          message: mapped ?? 'Nem sikerült frissíteni a tételt.'
        }
      }
      continue
    }
    maxSort += 1
    toInsert.push(
      ...itemRows(tenantId, po.id, [it]).map((row) => ({
        ...row,
        sort_order: maxSort
      }))
    )
  }

  if (toInsert.length) {
    const { error: insErr } = await ctx.supabase
      .from('purchase_order_items')
      .insert(toInsert)
    if (insErr) {
      const mapped = mapDbError(insErr.message)
      return {
        ok: false,
        message: mapped ?? 'Nem sikerült hozzáadni a tételeket.'
      }
    }
  }

  await ctx.supabase
    .from('purchase_orders')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', po.id)
    .eq('tenant_id', tenantId)

  revalidatePoPaths(po.id)
  return {
    ok: true,
    id: po.id,
    poNumber: (po.po_number as string | undefined) ?? undefined
  }
}

export async function updatePurchaseOrder(
  input: PurchaseOrderFormInput & { id: string }
): Promise<PurchaseOrderActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const merged = {
    ...input,
    items: mergePurchaseOrderItems(input.items)
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
    .select('id, status, order_kind')
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
  if (
    existing.order_kind &&
    existing.order_kind !== parsed.data.orderKind
  ) {
    return {
      ok: false,
      message: 'A rendelés típusa nem változtatható. Nyiss új rendelést.'
    }
  }

  const materialGate = await assertMaterialProcurementAllowed(
    ctx.supabase,
    tenantId,
    parsed.data.orderKind
  )
  if (materialGate) {
    return {
      ok: false,
      message: materialGate,
      fieldErrors: { orderKind: materialGate }
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
    .select('id, status, order_kind')
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

  const materialGate = await assertMaterialProcurementAllowed(
    ctx.supabase,
    tenantId,
    ((existing.order_kind as PurchaseOrderKind | null) || 'product') as PurchaseOrderKind
  )
  if (materialGate) {
    return { ok: false, message: materialGate }
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

export async function markPurchaseOrderEmailPrepared(
  id: string
): Promise<PurchaseOrderActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const { data: existing, error: loadErr } = await ctx.supabase
    .from('purchase_orders')
    .select('id, status, email_sent')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !existing) {
    return { ok: false, message: 'A rendelés nem található.' }
  }
  if (existing.status === 'cancelled') {
    return { ok: false, message: 'Visszavont rendeléshez nem jelölhető e-mail.' }
  }

  const { error } = await ctx.supabase
    .from('purchase_orders')
    .update({
      email_sent: true,
      email_sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('tenant_id', tenantId)

  if (error) {
    return { ok: false, message: 'Nem sikerült az e-mail jelölést menteni.' }
  }

  revalidatePoPaths(id)
  return { ok: true, id }
}

export async function fetchSupplierProcurementAidsAction(
  supplierId: string
): Promise<
  | { ok: true; aids: SupplierProcurementAids; supplierSkus: Record<string, string> }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs jogosultság.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Adatbázis nem elérhető.' }

  const aids = await getSupplierProcurementAids(
    supabase,
    user.tenantId,
    supplierId
  )
  if (!aids) {
    return { ok: false, message: 'A beszállító nem található.' }
  }

  return { ok: true, aids, supplierSkus: {} }
}

/** Beszállítói cikkszámok a megadott termékekhez. */
export async function fetchAccessorySupplierSkusAction(
  supplierId: string,
  accessoryIds: string[]
): Promise<
  | { ok: true; map: Record<string, string> }
  | { ok: false; message: string }
> {
  const user = await getSessionUser()
  if (!user?.tenantId || user.isDevSession) {
    return { ok: false, message: 'Nincs jogosultság.' }
  }
  const supabase = await createClient()
  if (!supabase) return { ok: false, message: 'Adatbázis nem elérhető.' }

  const map = await mapAccessorySupplierSkus(
    supabase,
    user.tenantId,
    supplierId,
    accessoryIds
  )
  return { ok: true, map }
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

export async function searchPurchaseSheetsAction(
  q: string
): Promise<
  | { ok: true; rows: Awaited<ReturnType<typeof searchSheetsForPurchaseOrder>> }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const materialGate = await assertMaterialProcurementAllowed(
    ctx.supabase,
    ctx.user.tenantId!,
    'material'
  )
  if (materialGate) return { ok: false, message: materialGate }

  try {
    const rows = await searchSheetsForPurchaseOrder(
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
          : 'Nem sikerült keresni a táblás anyagok között.'
    }
  }
}

export async function searchPurchaseLinearsAction(
  q: string
): Promise<
  | { ok: true; rows: Awaited<ReturnType<typeof searchLinearsForPurchaseOrder>> }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const materialGate = await assertMaterialProcurementAllowed(
    ctx.supabase,
    ctx.user.tenantId!,
    'material'
  )
  if (materialGate) return { ok: false, message: materialGate }

  try {
    const rows = await searchLinearsForPurchaseOrder(
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
          : 'Nem sikerült keresni a szálas anyagok között.'
    }
  }
}
