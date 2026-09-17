'use server'

import { revalidatePath } from 'next/cache'

import {
  receiptQuantitiesSchema,
  type ReceiptQuantitiesInput
} from '@/lib/goods-receipts/parse'
import {
  findCheckingReceiptForPo,
  getReceivedQtyByPoItem
} from '@/lib/goods-receipts/queries'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type GoodsReceiptActionResult =
  | { ok: true; id: string; poStatus?: string; message?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/beerkezesek'
const PO_PATH = '/beszallitoi-rendelesek'

function revalidateReceiptPaths(receiptId?: string, poId?: string) {
  revalidatePath(LIST_PATH)
  if (receiptId) revalidatePath(`${LIST_PATH}/${receiptId}`)
  revalidatePath(PO_PATH)
  if (poId) revalidatePath(`${PO_PATH}/${poId}`)
}

/**
 * Áru megérkezett — create-or-open checking beérkezés.
 * Ha minden tétel már teljes → nem nyit újat.
 */
export async function openOrCreateGoodsReceipt(
  purchaseOrderId: string
): Promise<GoodsReceiptActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const { data: po, error: poErr } = await ctx.supabase
    .from('purchase_orders')
    .select(
      `
      id,
      status,
      warehouse_id,
      purchase_order_items (
        id,
        accessory_id,
        name_snapshot,
        sku_snapshot,
        unit_shortform,
        quantity,
        sort_order,
        deleted_at
      )
    `
    )
    .eq('id', purchaseOrderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (poErr || !po) {
    return { ok: false, message: 'A rendelés nem található.' }
  }

  if (po.status !== 'ordered' && po.status !== 'partial') {
    return {
      ok: false,
      message:
        po.status === 'draft'
          ? 'Előbb jelöld megrendelve a rendelést.'
          : po.status === 'received'
            ? 'Minden tétel már beérkezett.'
            : 'Ehhez a rendeléshez nem lehet beérkezést nyitni.'
    }
  }

  if (!po.warehouse_id) {
    return {
      ok: false,
      message: 'A rendeléshez nincs raktár. Ellenőrizd a raktárakat.'
    }
  }

  const existing = await findCheckingReceiptForPo(
    ctx.supabase,
    tenantId,
    purchaseOrderId
  )
  if (existing) {
    return { ok: true, id: existing.id }
  }

  const receivedMap = await getReceivedQtyByPoItem(
    ctx.supabase,
    tenantId,
    purchaseOrderId
  )

  const poItems = (
    (po.purchase_order_items ?? []) as {
      id: string
      accessory_id: string
      name_snapshot: string
      sku_snapshot: string
      unit_shortform: string
      quantity: number
      sort_order: number
      deleted_at: string | null
    }[]
  ).filter((it) => !it.deleted_at)

  const remainingItems = poItems
    .map((it) => {
      const already = receivedMap.get(it.id) ?? 0
      const remaining = Number(it.quantity) - already
      return { ...it, remaining }
    })
    .filter((it) => it.remaining > 0.0001)
    .sort((a, b) => a.sort_order - b.sort_order)

  if (remainingItems.length === 0) {
    // Race: minden megvan, PO státusz frissítés
    await ctx.supabase
      .from('purchase_orders')
      .update({ status: 'received', updated_at: new Date().toISOString() })
      .eq('id', purchaseOrderId)
      .eq('tenant_id', tenantId)
    revalidateReceiptPaths(undefined, purchaseOrderId)
    return {
      ok: false,
      message: 'Minden tétel már beérkezett. A rendelés frissítve: Beérkezett.'
    }
  }

  const { data: receiptNumber, error: numErr } = await ctx.supabase.rpc(
    'generate_goods_receipt_number',
    { p_tenant_id: tenantId }
  )

  if (numErr || !receiptNumber) {
    return { ok: false, message: 'Nem sikerült beérkezés-számot generálni.' }
  }

  const { data: receipt, error: insertErr } = await ctx.supabase
    .from('goods_receipts')
    .insert({
      tenant_id: tenantId,
      purchase_order_id: purchaseOrderId,
      warehouse_id: po.warehouse_id,
      receipt_number: receiptNumber as string,
      status: 'checking'
    })
    .select('id')
    .single()

  if (insertErr || !receipt) {
    // Race: másik user már létrehozta a checking-et
    if (
      insertErr?.message?.includes('goods_receipts_one_checking_per_po') ||
      insertErr?.code === '23505'
    ) {
      const again = await findCheckingReceiptForPo(
        ctx.supabase,
        tenantId,
        purchaseOrderId
      )
      if (again) return { ok: true, id: again.id }
    }
    console.error('openOrCreateGoodsReceipt', insertErr?.message)
    return { ok: false, message: 'Nem sikerült létrehozni a beérkezést.' }
  }

  const { error: itemsErr } = await ctx.supabase
    .from('goods_receipt_items')
    .insert(
      remainingItems.map((it, index) => ({
        tenant_id: tenantId,
        goods_receipt_id: receipt.id,
        purchase_order_item_id: it.id,
        accessory_id: it.accessory_id,
        name_snapshot: it.name_snapshot,
        sku_snapshot: it.sku_snapshot,
        unit_shortform: it.unit_shortform,
        target_quantity: it.remaining,
        quantity_received: 0,
        sort_order: index
      }))
    )

  if (itemsErr) {
    await ctx.supabase
      .from('goods_receipts')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', receipt.id)
    console.error('openOrCreateGoodsReceipt items', itemsErr.message)
    return { ok: false, message: 'Nem sikerült létrehozni a beérkezés tételeit.' }
  }

  revalidateReceiptPaths(receipt.id, purchaseOrderId)
  return { ok: true, id: receipt.id }
}

export async function saveGoodsReceiptQuantities(
  receiptId: string,
  input: ReceiptQuantitiesInput
): Promise<GoodsReceiptActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = receiptQuantitiesSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: 'Ellenőrizd a mennyiségeket.' }
  }

  const tenantId = ctx.user.tenantId!

  const { data: receipt, error: loadErr } = await ctx.supabase
    .from('goods_receipts')
    .select('id, status, purchase_order_id')
    .eq('id', receiptId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !receipt) {
    return { ok: false, message: 'A beérkezés nem található.' }
  }

  if (receipt.status !== 'checking') {
    return {
      ok: false,
      message: 'Csak ellenőrzés alatt szerkeszthető a mennyiség.'
    }
  }

  for (const item of parsed.data.items) {
    const { error } = await ctx.supabase
      .from('goods_receipt_items')
      .update({
        quantity_received: item.quantityReceived,
        updated_at: new Date().toISOString()
      })
      .eq('id', item.id)
      .eq('goods_receipt_id', receiptId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)

    if (error) {
      console.error('saveGoodsReceiptQuantities', error.message)
      return { ok: false, message: 'Nem sikerült menteni a mennyiségeket.' }
    }
  }

  revalidateReceiptPaths(receiptId, receipt.purchase_order_id)
  return { ok: true, id: receiptId }
}

export async function receiveGoodsReceipt(
  receiptId: string
): Promise<GoodsReceiptActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const { data, error } = await ctx.supabase.rpc('receive_goods_receipt', {
    p_receipt_id: receiptId
  })

  if (error) {
    console.error('receiveGoodsReceipt', error.message)
    return { ok: false, message: 'Nem sikerült a bevételezés.' }
  }

  const result = data as {
    ok?: boolean
    message?: string
    po_id?: string
    po_status?: string
    already_received?: boolean
  } | null

  if (!result?.ok) {
    return {
      ok: false,
      message: result?.message ?? 'Nem sikerült a bevételezés.'
    }
  }

  revalidateReceiptPaths(receiptId, result.po_id)

  const statusLabel =
    result.po_status === 'received'
      ? 'Beérkezett'
      : result.po_status === 'partial'
        ? 'Részben beérkezett'
        : result.po_status

  return {
    ok: true,
    id: receiptId,
    poStatus: result.po_status,
    message: result.already_received
      ? `Már bevételezve. Rendelés: ${statusLabel}.`
      : `Bevételezve. Rendelés: ${statusLabel}.`
  }
}

export async function cancelGoodsReceipt(
  receiptId: string
): Promise<GoodsReceiptActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const { data: receipt, error: loadErr } = await ctx.supabase
    .from('goods_receipts')
    .select('id, status, purchase_order_id')
    .eq('id', receiptId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !receipt) {
    return { ok: false, message: 'A beérkezés nem található.' }
  }

  if (receipt.status !== 'checking') {
    return {
      ok: false,
      message: 'Csak ellenőrzés alatt lévő beérkezést lehet törölni.'
    }
  }

  const { data, error } = await ctx.supabase
    .from('goods_receipts')
    .update({
      status: 'cancelled',
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', receiptId)
    .eq('tenant_id', tenantId)
    .eq('status', 'checking')
    .is('deleted_at', null)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    return { ok: false, message: 'Nem sikerült törölni a beérkezést.' }
  }

  revalidateReceiptPaths(receiptId, receipt.purchase_order_id)
  return { ok: true, id: receiptId }
}

export type LookupAccessoryResult =
  | {
      ok: true
      accessory: {
        id: string
        name: string
        sku: string
        unitId: string
        unitShortform: string
        barcode: string | null
        barcodeInternal: string | null
      }
    }
  | { ok: false; message: string; notFound?: boolean }

/** Vonalkód / SKU → törzs termék (PO-n kívüli hozzáadáshoz). */
export async function lookupAccessoryForReceipt(
  code: string
): Promise<LookupAccessoryResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const safe = code.trim().replace(/[%_,]/g, '')
  if (!safe) {
    return {
      ok: false,
      message: 'Add meg a vonalkódot vagy SKU-t.',
      notFound: true
    }
  }

  const tenantId = ctx.user.tenantId!
  const { data, error } = await ctx.supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      barcode,
      barcode_internal,
      unit_id,
      units ( shortform )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .or(`sku.ilike.${safe},barcode.eq.${safe},barcode_internal.eq.${safe}`)
    .limit(5)

  if (error) {
    console.error('lookupAccessoryForReceipt', error.message)
    return { ok: false, message: 'Nem sikerült keresni a terméket.' }
  }

  const rows = data ?? []
  const exact =
    rows.find(
      (r) =>
        r.sku.toLowerCase() === safe.toLowerCase() ||
        r.barcode === safe ||
        r.barcode_internal === safe
    ) ?? rows[0]

  if (!exact) {
    return {
      ok: false,
      message: 'Ismeretlen termék — előbb vedd fel a Termékeknél.',
      notFound: true
    }
  }

  const units = exact.units as
    | { shortform: string }
    | { shortform: string }[]
    | null
  const unit = Array.isArray(units) ? units[0] : units

  return {
    ok: true,
    accessory: {
      id: exact.id,
      name: exact.name,
      sku: exact.sku,
      unitId: exact.unit_id,
      unitShortform: unit?.shortform ?? 'db',
      barcode: exact.barcode,
      barcodeInternal: exact.barcode_internal
    }
  }
}

/**
 * PO-n kívüli tétel hozzáadása checking beérkezéshez.
 * Ha már van a listán (PO vagy extra) → qty +1.
 */
export async function addExtraReceiptItem(input: {
  receiptId: string
  accessoryId: string
}): Promise<GoodsReceiptActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!

  const { data: receipt, error: loadErr } = await ctx.supabase
    .from('goods_receipts')
    .select('id, status, purchase_order_id')
    .eq('id', input.receiptId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !receipt) {
    return { ok: false, message: 'A beérkezés nem található.' }
  }
  if (receipt.status !== 'checking') {
    return { ok: false, message: 'Csak ellenőrzés alatt adhatsz hozzá tételt.' }
  }

  const { data: accessory, error: accErr } = await ctx.supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      unit_id,
      units ( shortform )
    `
    )
    .eq('id', input.accessoryId)
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (accErr || !accessory) {
    return { ok: false, message: 'A termék nem található vagy inaktív.' }
  }

  const { data: existingRows } = await ctx.supabase
    .from('goods_receipt_items')
    .select('id, quantity_received, is_extra')
    .eq('goods_receipt_id', input.receiptId)
    .eq('accessory_id', input.accessoryId)
    .is('deleted_at', null)

  const existing = (existingRows ?? [])[0]
  if (existing) {
    const nextQty = Number(existing.quantity_received) + 1
    const { error } = await ctx.supabase
      .from('goods_receipt_items')
      .update({
        quantity_received: nextQty,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
    if (error) {
      return { ok: false, message: 'Nem sikerült növelni a mennyiséget.' }
    }
    revalidateReceiptPaths(input.receiptId, receipt.purchase_order_id)
    return { ok: true, id: existing.id, message: `+1 ${accessory.name}` }
  }

  const units = accessory.units as
    | { shortform: string }
    | { shortform: string }[]
    | null
  const unit = Array.isArray(units) ? units[0] : units

  const { data: maxSort } = await ctx.supabase
    .from('goods_receipt_items')
    .select('sort_order')
    .eq('goods_receipt_id', input.receiptId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: created, error: insertErr } = await ctx.supabase
    .from('goods_receipt_items')
    .insert({
      tenant_id: tenantId,
      goods_receipt_id: input.receiptId,
      purchase_order_item_id: null,
      accessory_id: accessory.id,
      name_snapshot: accessory.name,
      sku_snapshot: accessory.sku,
      unit_shortform: unit?.shortform ?? 'db',
      target_quantity: 0,
      quantity_received: 1,
      is_extra: true,
      sort_order: (maxSort?.sort_order ?? 0) + 1
    })
    .select('id')
    .single()

  if (insertErr || !created) {
    console.error('addExtraReceiptItem', insertErr?.message)
    return { ok: false, message: 'Nem sikerült hozzáadni a tételt.' }
  }

  revalidateReceiptPaths(input.receiptId, receipt.purchase_order_id)
  return {
    ok: true,
    id: created.id,
    message: `PO-n kívüli tétel: ${accessory.name}`
  }
}

/** Checking beérkezés célraktárának módosítása (receive előtt). */
export async function updateGoodsReceiptWarehouse(
  receiptId: string,
  warehouseId: string
): Promise<GoodsReceiptActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  if (!warehouseId) {
    return { ok: false, message: 'Válassz célraktárat.' }
  }

  const tenantId = ctx.user.tenantId!

  const { data: receipt, error: loadErr } = await ctx.supabase
    .from('goods_receipts')
    .select('id, status, purchase_order_id')
    .eq('id', receiptId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (loadErr || !receipt) {
    return { ok: false, message: 'A beérkezés nem található.' }
  }
  if (receipt.status !== 'checking') {
    return {
      ok: false,
      message: 'Csak ellenőrzés alatt lévő beérkezés raktára módosítható.'
    }
  }

  const { data: warehouse, error: whErr } = await ctx.supabase
    .from('warehouses')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('id', warehouseId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (whErr || !warehouse) {
    return { ok: false, message: 'A célraktár nem található vagy inaktív.' }
  }

  const { error: updErr } = await ctx.supabase
    .from('goods_receipts')
    .update({
      warehouse_id: warehouse.id,
      updated_at: new Date().toISOString()
    })
    .eq('id', receiptId)
    .eq('tenant_id', tenantId)
    .eq('status', 'checking')

  if (updErr) {
    return { ok: false, message: 'Nem sikerült menteni a célraktárat.' }
  }

  revalidateReceiptPaths(receiptId, receipt.purchase_order_id)
  return { ok: true, id: receiptId }
}
