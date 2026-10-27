'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import { grossFromNet } from '@/lib/accessories/parse'
import {
  createCsoSchema,
  csoItemInputSchema,
  updateCsoHeaderSchema,
  updateCsoItemSchema,
  type CreateCsoInput,
  type CsoItemInput,
  type UpdateCsoHeaderInput,
  type UpdateCsoItemInput
} from '@/lib/customer-orders/parse'
import {
  csoItemEditRules,
  type CsoItemStatus,
  type CsoPoStatus
} from '@/lib/customer-orders/types'
import { createPurchaseOrder, appendItemsToDraftPurchaseOrder } from '@/lib/purchase-orders/actions'
import {
  getTenantSmsTemplate,
  insertSmsSendEvent
} from '@/lib/sms/templates'
import {
  formatSmsAmount,
  normalizeE164,
  renderSmsTemplate,
  smsSegments
} from '@/lib/sms/text'
import { sendTwilioSms } from '@/lib/sms/twilio'
import {
  CSO_READY_TEMPLATE_KEY,
  type CsoReadySmsCandidate,
  type SmsSkipReason
} from '@/lib/sms/types'
import {
  isCashPaymentMethodName,
  isDeferredPaymentMethodName
} from '@/lib/sales/payment-kind'
import { hungarianCashRound } from '@/lib/sales/totals'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'
import { ensureOrderShareLink } from '@/lib/order-status/links'
import { ensureDefaultWarehouse } from '@/lib/warehouses/queries'

export type CsoActionResult =
  | {
      ok: true
      id?: string
      message?: string
      /** Átadáskor létrejött értékesítés (első, ha több order). */
      saleId?: string
      saleNumber?: string
    }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/ugyfelrendelesek'
const CHANGED_MEANWHILE =
  'Közben valaki módosította a tételt — frissítsd az oldalt.'

function revalidateCso(id?: string) {
  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/varolista`)
  if (id) revalidatePath(`${LIST_PATH}/${id}`)
  revalidatePath('/beszallitoi-rendelesek')
  revalidatePath('/ertekesitesek')
  revalidatePath('/home')
}

/** Létrehozás: keskeny invalidálás — ne várjon /home + sales + PO listára. */
function revalidateCsoCreate(id: string) {
  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${id}`)
}

function revalidateCsoMany(orderIds: string[]) {
  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/varolista`)
  for (const id of new Set(orderIds)) {
    revalidatePath(`${LIST_PATH}/${id}`)
  }
  revalidatePath('/beszallitoi-rendelesek')
  revalidatePath('/ertekesitesek')
  revalidatePath('/home')
}

function fieldErrorsFromZod(
  issues: { path: (string | number)[]; message: string }[]
) {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}

function nowIso() {
  return new Date().toISOString()
}

function itemRowsForInsert(
  tenantId: string,
  orderId: string,
  items: CsoItemInput[],
  startSort: number
) {
  return items.map((it, index) => ({
    tenant_id: tenantId,
    order_id: orderId,
    name: it.name,
    qty: it.qty,
    unit_shortform: it.unitShortform || 'db',
    sku_snapshot: it.sku ?? null,
    unit_price_gross: it.unitPriceGross ?? null,
    accessory_id: it.accessoryId ?? null,
    supplier_id: it.supplierId ?? null,
    note: it.note ?? null,
    status: 'felveve',
    sort_order: startSort + index
  }))
}

// ---------------------------------------------------------------------------
// Létrehozás
// ---------------------------------------------------------------------------

export async function createCustomerSpecialOrderAction(
  input: CreateCsoInput
): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = createCsoSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }

  const tenantId = ctx.user.tenantId!
  const d = parsed.data

  let customerId = d.customerId ?? null
  if (!customerId) {
    const { data: existing } = await ctx.supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .ilike('name', d.customerName)
      .maybeSingle()

    if (existing?.id) {
      customerId = existing.id as string
      await ctx.supabase
        .from('customers')
        .update({ mobile: d.customerMobile, updated_at: nowIso() })
        .eq('id', customerId)
        .eq('tenant_id', tenantId)
    } else {
      const { data: created, error: cErr } = await ctx.supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          name: d.customerName,
          mobile: d.customerMobile
        })
        .select('id')
        .single()
      if (cErr || !created) {
        console.error('createCso customer', cErr?.message)
        return { ok: false, message: 'Nem sikerült az ügyfelet létrehozni.' }
      }
      customerId = created.id as string
    }
  }

  let order: { id: string } | null = null
  let oErr: { message: string } | null = null
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    const { data: orderNumber, error: numErr } = await ctx.supabase.rpc(
      'generate_customer_special_order_number',
      { p_tenant_id: tenantId }
    )
    if (numErr || !orderNumber) {
      console.error('createCso number', numErr?.message)
      return { ok: false, message: 'Nem sikerült rendelésszámot generálni.' }
    }

    const res = await ctx.supabase
      .from('customer_special_orders')
      .insert({
        tenant_id: tenantId,
        order_number: orderNumber as string,
        customer_id: customerId,
        customer_name: d.customerName,
        customer_mobile: d.customerMobile,
        status: 'felveve',
        deposit_amount: d.depositAmount ?? null,
        promised_date: d.promisedDate ?? null,
        note: d.note ?? null,
        created_by: ctx.user.id
      })
      .select('id')
      .single()

    order = res.data as { id: string } | null
    oErr = res.error
    if (res.error && res.error.code !== '23505') break
  }

  if (oErr || !order) {
    console.error('createCso order', oErr?.message)
    return { ok: false, message: 'Nem sikerült menteni a rendelést.' }
  }

  const { error: iErr } = await ctx.supabase
    .from('customer_special_order_items')
    .insert(itemRowsForInsert(tenantId, order.id, d.items, 0))

  if (iErr) {
    console.error('createCso items', iErr.message)
    await ctx.supabase
      .from('customer_special_orders')
      .update({ deleted_at: nowIso() })
      .eq('id', order.id)
    return { ok: false, message: 'Nem sikerült menteni a tételeket.' }
  }

  revalidateCsoCreate(order.id)
  return { ok: true, id: order.id }
}

// ---------------------------------------------------------------------------
// Fej szerkesztése
// ---------------------------------------------------------------------------

export async function updateSpecialOrderHeaderAction(
  input: { orderId: string } & UpdateCsoHeaderInput
): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = updateCsoHeaderSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const tenantId = ctx.user.tenantId!
  const d = parsed.data

  const { data: current } = await ctx.supabase
    .from('customer_special_orders')
    .select('id, customer_mobile, status')
    .eq('id', input.orderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!current) return { ok: false, message: 'A rendelés nem található.' }

  const mobileChanged = current.customer_mobile !== d.customerMobile

  const { data: updated, error } = await ctx.supabase
    .from('customer_special_orders')
    .update({
      customer_name: d.customerName,
      customer_mobile: d.customerMobile,
      deposit_amount: d.depositAmount ?? null,
      promised_date: d.promisedDate ?? null,
      note: d.note ?? null,
      ...(mobileChanged ? { sms_sent_at: null } : {}),
      updated_at: nowIso()
    })
    .eq('id', input.orderId)
    .eq('tenant_id', tenantId)
    .select('id')

  if (error || !updated?.length) {
    console.error('updateCsoHeader', error?.message)
    return { ok: false, message: 'Nem sikerült menteni az adatokat.' }
  }

  revalidateCso(input.orderId)
  return {
    ok: true,
    id: input.orderId,
    message: mobileChanged
      ? 'Mentve. Új telefonszám — az értesítő SMS újra kiküldhető.'
      : 'Mentve.'
  }
}

// ---------------------------------------------------------------------------
// Új tétel hozzáadása meglévő rendeléshez
// ---------------------------------------------------------------------------

export async function addSpecialOrderItemsAction(input: {
  orderId: string
  items: CsoItemInput[]
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = csoItemInputSchema.array().min(1).max(50).safeParse(input.items)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Ellenőrizd a tételt.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const tenantId = ctx.user.tenantId!

  const { data: order } = await ctx.supabase
    .from('customer_special_orders')
    .select('id')
    .eq('id', input.orderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!order) return { ok: false, message: 'A rendelés nem található.' }

  const { data: last } = await ctx.supabase
    .from('customer_special_order_items')
    .select('sort_order')
    .eq('order_id', input.orderId)
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const startSort = Number(last?.sort_order ?? -1) + 1

  const { error } = await ctx.supabase
    .from('customer_special_order_items')
    .insert(itemRowsForInsert(tenantId, input.orderId, parsed.data, startSort))

  if (error) {
    console.error('addCsoItems', error.message)
    return { ok: false, message: 'Nem sikerült hozzáadni a tételt.' }
  }

  // Új felvett tétel → a rendelés még nincs kész; a „kész” SMS újra küldhető lesz.
  await ctx.supabase
    .from('customer_special_orders')
    .update({ sms_sent_at: null, updated_at: nowIso() })
    .eq('id', input.orderId)
    .eq('tenant_id', tenantId)

  revalidateCso(input.orderId)
  return { ok: true, id: input.orderId, message: 'Tétel hozzáadva.' }
}

// ---------------------------------------------------------------------------
// Tétel szerkesztése (státusz szerinti szabályokkal)
// ---------------------------------------------------------------------------

type ItemWithPo = {
  id: string
  order_id: string
  name: string
  qty: number
  status: CsoItemStatus
  accessory_id: string | null
  purchase_order_item_id: string | null
  poStatus: CsoPoStatus | null
  poId: string | null
  poItemQty: number | null
}

async function loadItemWithPo(
  supabase: SupabaseClient,
  tenantId: string,
  orderId: string,
  itemId: string
): Promise<ItemWithPo | null> {
  const { data } = await supabase
    .from('customer_special_order_items')
    .select(
      `
      id, order_id, name, qty, status, accessory_id, purchase_order_item_id,
      purchase_order_items (
        id, quantity, purchase_order_id,
        purchase_orders ( status )
      )
    `
    )
    .eq('id', itemId)
    .eq('order_id', orderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!data) return null
  const poiRaw = data.purchase_order_items as unknown
  const poi = (Array.isArray(poiRaw) ? poiRaw[0] : poiRaw) as
    | {
        id: string
        quantity: number
        purchase_order_id: string
        purchase_orders: { status: string } | { status: string }[] | null
      }
    | null
    | undefined
  const poRaw = poi?.purchase_orders ?? null
  const po = Array.isArray(poRaw) ? poRaw[0] : poRaw

  return {
    id: data.id as string,
    order_id: data.order_id as string,
    name: data.name as string,
    qty: Number(data.qty),
    status: data.status as CsoItemStatus,
    accessory_id: (data.accessory_id as string | null) ?? null,
    purchase_order_item_id:
      (data.purchase_order_item_id as string | null) ?? null,
    poStatus: (po?.status as CsoPoStatus | undefined) ?? null,
    poId: poi?.purchase_order_id ?? null,
    poItemQty: poi ? Number(poi.quantity) : null
  }
}

export async function updateSpecialOrderItemAction(input: {
  orderId: string
  itemId: string
  patch: UpdateCsoItemInput
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = updateCsoItemSchema.safeParse(input.patch)
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Ellenőrizd a mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const tenantId = ctx.user.tenantId!
  const item = await loadItemWithPo(
    ctx.supabase,
    tenantId,
    input.orderId,
    input.itemId
  )
  if (!item) return { ok: false, message: 'A tétel nem található.' }

  const rules = csoItemEditRules(item.status, item.poStatus)
  const p = parsed.data
  const update: Record<string, unknown> = {}
  const denied: string[] = []

  if (p.name !== undefined && p.name !== item.name) {
    if (!rules.name || item.accessory_id) denied.push('név')
    else update.name = p.name
  }
  if (p.sku !== undefined) {
    if (!rules.sku || item.accessory_id) {
      if (p.sku !== null) denied.push('SKU')
    } else update.sku_snapshot = p.sku
  }
  if (p.supplierId !== undefined) {
    if (!rules.supplier) denied.push('beszállító')
    else update.supplier_id = p.supplierId
  }
  if (p.unitPriceGross !== undefined) {
    if (!rules.price) denied.push('ár')
    else update.unit_price_gross = p.unitPriceGross
  }
  if (p.note !== undefined) {
    if (!rules.note) denied.push('megjegyzés')
    else update.note = p.note
  }

  let qtyDelta = 0
  if (p.qty !== undefined && p.qty !== item.qty) {
    if (!rules.qty) {
      return {
        ok: false,
        message: rules.qtyLockedReason ?? 'A mennyiség nem módosítható.'
      }
    }
    update.qty = p.qty
    qtyDelta = p.qty - item.qty
  }

  if (denied.length) {
    return {
      ok: false,
      message: `Ebben a státuszban nem módosítható: ${denied.join(', ')}.`
    }
  }
  if (Object.keys(update).length === 0) {
    return { ok: true, id: input.orderId, message: 'Nincs változás.' }
  }

  // Rendelve + vázlat PO: a PO-sor mennyiségét is igazítjuk.
  if (qtyDelta !== 0 && item.status === 'rendelve' && item.purchase_order_item_id) {
    const nextPoQty = (item.poItemQty ?? 0) + qtyDelta
    if (nextPoQty <= 0) {
      return { ok: false, message: 'A beszállítói rendelés sora nem lehet 0.' }
    }
    const { data: poUpd, error: poErr } = await ctx.supabase
      .from('purchase_order_items')
      .update({ quantity: nextPoQty, updated_at: nowIso() })
      .eq('id', item.purchase_order_item_id)
      .eq('tenant_id', tenantId)
      .select('id')
    if (poErr || !poUpd?.length) {
      console.error('updateCsoItem po qty', poErr?.message)
      return {
        ok: false,
        message: 'Nem sikerült a beszállítói rendelést igazítani.'
      }
    }
  }

  update.updated_at = nowIso()
  const { data: updated, error } = await ctx.supabase
    .from('customer_special_order_items')
    .update(update)
    .eq('id', item.id)
    .eq('tenant_id', tenantId)
    .eq('status', item.status)
    .select('id')

  if (error) {
    console.error('updateCsoItem', error.message)
    return { ok: false, message: 'Nem sikerült menteni a tételt.' }
  }
  if (!updated?.length) return { ok: false, message: CHANGED_MEANWHILE }

  revalidateCso(input.orderId)
  return {
    ok: true,
    id: input.orderId,
    message:
      qtyDelta !== 0 && item.status === 'rendelve'
        ? 'Mentve. A beszállítói rendelés (vázlat) mennyisége is frissült.'
        : 'Mentve.'
  }
}

/** Szabad tételhez katalógus termék: név, SKU, egység, ár, fő beszállító is frissül. */
export async function attachAccessoryToSpecialOrderItemAction(input: {
  orderId: string
  itemId: string
  accessoryId: string
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const { data: item } = await ctx.supabase
    .from('customer_special_order_items')
    .select('id, status, supplier_id, unit_price_gross')
    .eq('id', input.itemId)
    .eq('order_id', input.orderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!item) return { ok: false, message: 'A tétel nem található.' }
  if (item.status !== 'felveve') {
    return {
      ok: false,
      message: 'Termék csak „Felvéve” státuszú tételhez rendelhető.'
    }
  }

  const { data: acc } = await ctx.supabase
    .from('accessories')
    .select(
      `
      id, name, sku, price_net,
      tax_rates ( rate_percent ),
      units ( shortform ),
      accessory_suppliers ( supplier_id, is_primary, sort_order )
    `
    )
    .eq('id', input.accessoryId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!acc) return { ok: false, message: 'A termék nem található.' }

  const tax = Array.isArray(acc.tax_rates) ? acc.tax_rates[0] : acc.tax_rates
  const unit = Array.isArray(acc.units) ? acc.units[0] : acc.units
  const links = (
    (acc.accessory_suppliers ?? []) as Array<{
      supplier_id: string
      is_primary: boolean
      sort_order: number
    }>
  )
    .slice()
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order
    )
  const primarySupplier = links[0]?.supplier_id ?? null
  const gross = grossFromNet(
    Number(acc.price_net) || 0,
    Number((tax as { rate_percent?: number } | null)?.rate_percent) || 0
  )

  const { data: updated, error } = await ctx.supabase
    .from('customer_special_order_items')
    .update({
      accessory_id: acc.id,
      name: acc.name,
      sku_snapshot: acc.sku ?? null,
      unit_shortform:
        (unit as { shortform?: string } | null)?.shortform || 'db',
      supplier_id: item.supplier_id ?? primarySupplier,
      unit_price_gross: item.unit_price_gross ?? (gross > 0 ? gross : null),
      updated_at: nowIso()
    })
    .eq('id', item.id)
    .eq('tenant_id', tenantId)
    .eq('status', 'felveve')
    .select('id')

  if (error) {
    console.error('attachAccessory', error.message)
    return { ok: false, message: 'Nem sikerült a terméket hozzárendelni.' }
  }
  if (!updated?.length) return { ok: false, message: CHANGED_MEANWHILE }

  revalidateCso(input.orderId)
  return { ok: true, id: input.orderId, message: 'Termék hozzárendelve.' }
}

// ---------------------------------------------------------------------------
// Beszállítói listára (PO vázlat)
// ---------------------------------------------------------------------------

type LeadItemRow = {
  id: string
  order_id: string
  name: string
  qty: number
  unit_shortform: string
  accessory_id: string | null
  supplier_id: string | null
  status: string
  accessories: unknown
}

type LeadAccessory = {
  id: string
  name: string
  sku: string | null
  purchase_price_net: number | null
  tax_rate_id: string | null
  unit_id: string | null
  tax_rates: { rate_percent: number } | { rate_percent: number }[] | null
  units: { id: string; shortform: string } | { id: string; shortform: string }[] | null
}

export type CsoLeadDraftOption = {
  id: string
  poNumber: string
  itemCount: number
  createdAt: string
}

export type CsoLeadSupplierPreview = {
  supplierId: string
  supplierName: string
  itemCount: number
  drafts: CsoLeadDraftOption[]
}

export type CsoLeadPreviewResult =
  | {
      ok: true
      warehouseId: string
      suppliers: CsoLeadSupplierPreview[]
    }
  | { ok: false; message: string }

export type CsoLeadSupplierTarget =
  | { mode: 'new' }
  | { mode: 'append'; purchaseOrderId: string }

/** Előnézet: beszállítónként a nyitott (draft) PO-k ugyanarra a raktárra. */
export async function previewSpecialOrderLeadDraftsAction(input: {
  itemIds: string[]
  warehouseId?: string
}): Promise<CsoLeadPreviewResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  if (!input.itemIds.length) {
    return { ok: false, message: 'Válassz legalább egy tételt.' }
  }

  const { data: items, error } = await ctx.supabase
    .from('customer_special_order_items')
    .select(
      `
      id, name, supplier_id, status, accessory_id,
      suppliers ( name )
    `
    )
    .eq('tenant_id', tenantId)
    .in('id', input.itemIds)
    .is('deleted_at', null)

  if (error || !items?.length) {
    return { ok: false, message: 'A tételek nem találhatók.' }
  }

  for (const it of items) {
    if (it.status !== 'felveve') {
      return {
        ok: false,
        message: 'Csak „Felvéve” státuszú tétel tehető beszállítói listára.'
      }
    }
    if (!it.accessory_id) {
      return {
        ok: false,
        message: `„${it.name}”: előbb rendelj hozzá katalógus terméket.`
      }
    }
    if (!it.supplier_id) {
      return { ok: false, message: `„${it.name}”: válassz beszállítót.` }
    }
  }

  let warehouseId = input.warehouseId
  if (!warehouseId) {
    const wh = await ensureDefaultWarehouse(ctx.supabase, tenantId)
    warehouseId = wh.id
  }

  const bySupplier = new Map<
    string,
    { name: string; count: number }
  >()
  for (const it of items) {
    const sid = it.supplier_id as string
    const suppliers = it.suppliers as
      | { name?: string }
      | { name?: string }[]
      | null
    const name = Array.isArray(suppliers)
      ? (suppliers[0]?.name ?? 'Beszállító')
      : (suppliers?.name ?? 'Beszállító')
    const prev = bySupplier.get(sid)
    if (prev) prev.count += 1
    else bySupplier.set(sid, { name, count: 1 })
  }

  const supplierIds = [...bySupplier.keys()]
  const { data: drafts, error: draftErr } = await ctx.supabase
    .from('purchase_orders')
    .select(
      `
      id, po_number, supplier_id, created_at,
      purchase_order_items ( id, deleted_at )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('status', 'draft')
    .eq('warehouse_id', warehouseId)
    .in('supplier_id', supplierIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (draftErr) {
    console.error('preview lead drafts', draftErr.message)
    return { ok: false, message: 'Nem sikerült betölteni a vázlatokat.' }
  }

  const draftsBySupplier = new Map<string, CsoLeadDraftOption[]>()
  for (const d of drafts ?? []) {
    const sid = d.supplier_id as string
    const poi = ((d.purchase_order_items ?? []) as { id: string; deleted_at: string | null }[]).filter(
      (row) => !row.deleted_at
    )
    const opt: CsoLeadDraftOption = {
      id: d.id as string,
      poNumber: (d.po_number as string) ?? 'PO',
      itemCount: poi.length,
      createdAt: (d.created_at as string) ?? ''
    }
    const list = draftsBySupplier.get(sid) ?? []
    list.push(opt)
    draftsBySupplier.set(sid, list)
  }

  const suppliers: CsoLeadSupplierPreview[] = supplierIds.map((sid) => {
    const meta = bySupplier.get(sid)!
    return {
      supplierId: sid,
      supplierName: meta.name,
      itemCount: meta.count,
      drafts: draftsBySupplier.get(sid) ?? []
    }
  })

  return { ok: true, warehouseId, suppliers }
}

/** Beszállítói listára — több UR; beszállítónként új vázlat vagy meglévő draft. */
export async function leadSpecialOrderItemsToSupplierAction(input: {
  /** Részletről opcionális (revalidate); várólistáról elhagyható. */
  orderId?: string
  itemIds: string[]
  warehouseId?: string
  /**
   * Beszállítónként: új vázlat vagy append.
   * Ha hiányzik: új vázlat (visszafelé kompatibilis).
   */
  supplierTargets?: Record<string, CsoLeadSupplierTarget>
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  if (!input.itemIds.length) {
    return { ok: false, message: 'Válassz legalább egy tételt.' }
  }

  const { data: items, error } = await ctx.supabase
    .from('customer_special_order_items')
    .select(
      `
      id, order_id, name, qty, unit_shortform, accessory_id, supplier_id, status,
      accessories (
        id, name, sku, purchase_price_net, tax_rate_id, unit_id,
        tax_rates ( rate_percent ),
        units ( id, shortform )
      )
    `
    )
    .eq('tenant_id', tenantId)
    .in('id', input.itemIds)
    .is('deleted_at', null)

  if (error || !items?.length) {
    return { ok: false, message: 'A tételek nem találhatók.' }
  }

  const rows = items as LeadItemRow[]
  for (const it of rows) {
    if (it.status !== 'felveve') {
      return { ok: false, message: 'Csak „Felvéve” státuszú tétel tehető beszállítói listára.' }
    }
    if (!it.accessory_id) {
      return {
        ok: false,
        message: `„${it.name}”: előbb rendelj hozzá katalógus terméket (beszállítói rendeléshez kell).`
      }
    }
    if (!it.supplier_id) {
      return { ok: false, message: `„${it.name}”: válassz beszállítót.` }
    }
    const acc = (Array.isArray(it.accessories)
      ? it.accessories[0]
      : it.accessories) as LeadAccessory | null
    if (!acc?.tax_rate_id || !acc.unit_id) {
      return {
        ok: false,
        message: `„${it.name}”: a terméknek hiányzik az adóneme vagy egysége.`
      }
    }
  }

  // Claim: előbb lefoglaljuk a tételeket (felveve → rendelve), hogy dupla listázás ne legyen.
  const { data: claimed, error: claimErr } = await ctx.supabase
    .from('customer_special_order_items')
    .update({ status: 'rendelve', updated_at: nowIso() })
    .eq('tenant_id', tenantId)
    .in(
      'id',
      rows.map((r) => r.id)
    )
    .eq('status', 'felveve')
    .select('id')

  if (claimErr) {
    console.error('lead claim', claimErr.message)
    return { ok: false, message: 'Nem sikerült a tételeket beszállítói listára tenni.' }
  }
  const claimedIds = new Set((claimed ?? []).map((c) => c.id as string))
  if (claimedIds.size !== rows.length) {
    if (claimedIds.size) {
      await revertToFelveve(ctx.supabase, tenantId, [...claimedIds])
    }
    return { ok: false, message: CHANGED_MEANWHILE }
  }

  let warehouseId = input.warehouseId
  if (!warehouseId) {
    const wh = await ensureDefaultWarehouse(ctx.supabase, tenantId)
    warehouseId = wh.id
  }

  const bySupplier = new Map<string, LeadItemRow[]>()
  for (const it of rows) {
    const sid = it.supplier_id as string
    if (!bySupplier.has(sid)) bySupplier.set(sid, [])
    bySupplier.get(sid)!.push(it)
  }

  const results: string[] = []
  const failed: string[] = []
  let missingCost = 0

  for (const [supplierId, group] of bySupplier) {
    const poItems = group.map((it) => {
      const acc = (Array.isArray(it.accessories)
        ? it.accessories[0]
        : it.accessories) as LeadAccessory
      const tax = Array.isArray(acc.tax_rates) ? acc.tax_rates[0] : acc.tax_rates
      const unit = Array.isArray(acc.units) ? acc.units[0] : acc.units
      const cost = Number(acc.purchase_price_net ?? 0)
      if (!(cost > 0)) missingCost += 1
      return {
        lineKind: 'accessory' as const,
        accessoryId: acc.id,
        nameSnapshot: acc.name || it.name,
        skuSnapshot: acc.sku || '—',
        quantity: Number(it.qty),
        netPrice: cost > 0 ? Math.round(cost) : 0,
        taxRateId: acc.tax_rate_id as string,
        taxRatePercent: Number(tax?.rate_percent ?? 27),
        unitId: acc.unit_id as string,
        unitShortform: unit?.shortform || it.unit_shortform || 'db'
      }
    })

    const target = input.supplierTargets?.[supplierId] ?? { mode: 'new' as const }
    let poId: string | null = null
    let poNumber = 'PO'
    let label = ''

    if (target.mode === 'append') {
      const appendRes = await appendItemsToDraftPurchaseOrder({
        purchaseOrderId: target.purchaseOrderId,
        supplierId,
        warehouseId,
        items: poItems
      })
      if (!appendRes.ok) {
        await revertToFelveve(
          ctx.supabase,
          tenantId,
          group.map((g) => g.id)
        )
        failed.push(appendRes.message)
        continue
      }
      poId = appendRes.id
      poNumber = appendRes.poNumber ?? 'PO'
      label = `${poNumber} (hozzáadva)`
    } else {
      const poRes = await createPurchaseOrder({
        orderKind: 'product',
        supplierId,
        warehouseId,
        expectedDate: '',
        note: 'Ügyfélrendelés — beszállítói lista (vázlat)',
        currency: 'HUF',
        items: poItems
      })

      if (!poRes.ok) {
        await revertToFelveve(
          ctx.supabase,
          tenantId,
          group.map((g) => g.id)
        )
        failed.push(poRes.message)
        continue
      }
      poId = poRes.id
      const { data: poRow } = await ctx.supabase
        .from('purchase_orders')
        .select('po_number')
        .eq('id', poRes.id)
        .maybeSingle()
      poNumber = (poRow?.po_number as string | undefined) ?? 'PO'
      label = `${poNumber} (új vázlat)`
    }

    const { data: poItemRows, error: poItemsErr } = await ctx.supabase
      .from('purchase_order_items')
      .select('id, accessory_id')
      .eq('purchase_order_id', poId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)

    if (poItemsErr || !poItemRows?.length) {
      await revertToFelveve(
        ctx.supabase,
        tenantId,
        group.map((g) => g.id)
      )
      failed.push(
        poItemsErr?.message ??
          'A beszállítói rendelés tételei nem találhatók — próbáld újra.'
      )
      continue
    }

    let linkFailed = false
    for (const it of group) {
      const match = poItemRows.find((p) => p.accessory_id === it.accessory_id)
      if (!match) {
        linkFailed = true
        failed.push(
          `„${it.name}”: nem sikerült a beszállítói tételhez kötni (accessory).`
        )
        continue
      }
      const { data: linked, error: linkErr } = await ctx.supabase
        .from('customer_special_order_items')
        .update({
          purchase_order_item_id: match.id,
          updated_at: nowIso()
        })
        .eq('id', it.id)
        .eq('tenant_id', tenantId)
        .select('id')

      if (linkErr || !linked?.length) {
        linkFailed = true
        failed.push(
          `„${it.name}”: nem sikerült a PO-link mentése${linkErr ? `: ${linkErr.message}` : ''}.`
        )
      }
    }

    if (linkFailed) {
      await revertToFelveve(
        ctx.supabase,
        tenantId,
        group.map((g) => g.id)
      )
      // PO vázlat megmaradhat — de a CSO ne legyen „rendelve” link nélkül
      continue
    }

    results.push(label)
  }

  const orderIds = rows.map((r) => r.order_id)
  revalidateCsoMany(orderIds)

  if (!results.length) {
    return {
      ok: false,
      message: failed[0] ?? 'Nem sikerült beszállítói rendelést létrehozni.'
    }
  }

  const parts = [
    `Beszállítói lista: ${results.join(', ')}. Ha még vázlat, a Beszállítói rendelések oldalon küldd el / e-mailezd.`
  ]
  if (missingCost) {
    parts.push(
      `${missingCost} tételnél nincs beszerzési ár — a vázlatban 0 Ft, pótold.`
    )
  }
  if (failed.length) {
    parts.push(`Sikertelen: ${failed.join('; ')}`)
  }
  return {
    ok: true,
    id: input.orderId ?? orderIds[0],
    message: parts.join(' ')
  }
}

async function revertToFelveve(
  supabase: SupabaseClient,
  tenantId: string,
  ids: string[]
) {
  await supabase
    .from('customer_special_order_items')
    .update({
      status: 'felveve',
      purchase_order_item_id: null,
      updated_at: nowIso()
    })
    .eq('tenant_id', tenantId)
    .in('id', ids)
    .eq('status', 'rendelve')
}

// ---------------------------------------------------------------------------
// Megérkezett (kézi) / Átadás
// ---------------------------------------------------------------------------

export async function markSpecialOrderItemsArrivedAction(input: {
  /** Részletről; várólistán elhagyható — az itemIds alapján csoportosítunk. */
  orderId?: string
  itemIds: string[]
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  if (!input.itemIds.length) {
    return { ok: false, message: 'Válassz legalább egy tételt.' }
  }
  const warehouse = await ensureDefaultWarehouse(ctx.supabase, tenantId)

  let q = ctx.supabase
    .from('customer_special_order_items')
    .select('id, order_id, qty, status')
    .eq('tenant_id', tenantId)
    .in('id', input.itemIds)
    .is('deleted_at', null)
  if (input.orderId) q = q.eq('order_id', input.orderId)

  const { data: items, error } = await q

  if (error || !items?.length) {
    return { ok: false, message: 'A tételek nem találhatók.' }
  }

  let done = 0
  for (const it of items) {
    if (it.status !== 'rendelve' && it.status !== 'felveve') {
      return {
        ok: false,
        message: 'Csak „Felvéve” vagy „Beszerzés alatt” tétel jelölhető megérkezettnek.'
      }
    }
    const { data: upd } = await ctx.supabase
      .from('customer_special_order_items')
      .update({
        status: 'itt_van',
        reserved_qty: it.qty,
        reserved_at: nowIso(),
        warehouse_id: warehouse.id,
        updated_at: nowIso()
      })
      .eq('id', it.id)
      .eq('tenant_id', tenantId)
      .eq('status', it.status)
      .select('id')
    if (upd?.length) done += 1
  }

  if (!done) return { ok: false, message: CHANGED_MEANWHILE }

  const orderIds = [...new Set(items.map((i) => i.order_id as string))]

  revalidateCsoMany(orderIds)
  return {
    ok: true,
    id: input.orderId ?? orderIds[0],
    message: `${done} tétel: Itt van (foglalva). Küldj SMS-t a rendelésről vagy a várólistáról.`
  }
}

/**
 * Átadás = értékesítés létrehozása + tételek atadva.
 * Készlet csak a sale fulfill-nél megy ki (nincs külön CSO stock out).
 */
export async function handOverSpecialOrderItemsAction(input: {
  orderId?: string
  itemIds: string[]
  paymentMethodId: string
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const tenantId = ctx.user.tenantId!
  const supabase = ctx.supabase
  const userId = ctx.user.id
  if (!input.itemIds.length) {
    return { ok: false, message: 'Válassz legalább egy tételt.' }
  }
  const paymentMethodId = input.paymentMethodId?.trim()
  if (!paymentMethodId) {
    return { ok: false, message: 'Válassz fizetési módot.' }
  }

  const { data: payMethod, error: payErr } = await supabase
    .from('payment_methods')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .eq('id', paymentMethodId)
    .eq('active', true)
    .is('deleted_at', null)
    .maybeSingle()
  if (payErr || !payMethod) {
    return { ok: false, message: 'Érvénytelen fizetési mód.' }
  }
  const deferred = isDeferredPaymentMethodName(payMethod.name)

  let q = supabase
    .from('customer_special_order_items')
    .select(
      `
      id, order_id, name, qty, status, accessory_id, material_id,
      linear_material_id, warehouse_id, reserved_qty, unit_price_gross,
      customer_special_orders!inner (
        id, order_number, customer_id, customer_name, customer_mobile,
        deposit_amount, sales_order_id, deleted_at
      )
    `
    )
    .eq('tenant_id', tenantId)
    .in('id', input.itemIds)
    .is('deleted_at', null)
    .is('customer_special_orders.deleted_at', null)
  if (input.orderId) q = q.eq('order_id', input.orderId)

  const { data: rawItems, error } = await q
  if (error || !rawItems?.length) {
    return { ok: false, message: 'A tételek nem találhatók.' }
  }
  if (rawItems.some((it) => it.status !== 'itt_van')) {
    return { ok: false, message: 'Csak „Átvehető” (itt van) tételt lehet átadni.' }
  }
  if (
    rawItems.some(
      (it) => it.unit_price_gross == null || !Number.isFinite(Number(it.unit_price_gross))
    )
  ) {
    return {
      ok: false,
      message: 'Minden átadandó tételnek legyen ára — szerkeszd a hiányzó árakat.'
    }
  }

  type OrderHead = {
    id: string
    order_number: string
    customer_id: string | null
    customer_name: string
    customer_mobile: string
    deposit_amount: number | null
    sales_order_id: string | null
  }

  type HandoverItem = {
    id: string
    order_id: string
    name: string
    qty: number
    accessory_id: string | null
    material_id: string | null
    linear_material_id: string | null
    warehouse_id: string | null
    reserved_qty: number | null
    unit_price_gross: number
    order: OrderHead
  }

  const items: HandoverItem[] = []
  for (const row of rawItems) {
    const ordRaw = row.customer_special_orders as
      | OrderHead
      | OrderHead[]
      | null
    const ord = Array.isArray(ordRaw) ? ordRaw[0] : ordRaw
    if (!ord || (ord as { deleted_at?: string | null }).deleted_at) {
      return { ok: false, message: 'A rendelés nem található.' }
    }
    items.push({
      id: row.id as string,
      order_id: row.order_id as string,
      name: String(row.name),
      qty: Number(row.qty),
      accessory_id: (row.accessory_id as string | null) ?? null,
      material_id: (row.material_id as string | null) ?? null,
      linear_material_id: (row.linear_material_id as string | null) ?? null,
      warehouse_id: (row.warehouse_id as string | null) ?? null,
      reserved_qty:
        row.reserved_qty != null ? Number(row.reserved_qty) : null,
      unit_price_gross: Number(row.unit_price_gross),
      order: {
        id: ord.id,
        order_number: ord.order_number,
        customer_id: ord.customer_id,
        customer_name: ord.customer_name,
        customer_mobile: ord.customer_mobile ?? '',
        deposit_amount: ord.deposit_amount,
        sales_order_id: ord.sales_order_id
      }
    })
  }

  const byOrder = new Map<string, HandoverItem[]>()
  for (const it of items) {
    const list = byOrder.get(it.order_id) ?? []
    list.push(it)
    byOrder.set(it.order_id, list)
  }

  const defaultWh = await ensureDefaultWarehouse(supabase, tenantId)
  const createdSales: { saleId: string; saleNumber: string; orderId: string }[] =
    []
  const orderIds = [...byOrder.keys()]

  for (const [orderId, orderItems] of byOrder) {
    const head = orderItems[0]!.order
    const whIds = [
      ...new Set(
        orderItems
          .map((i) => i.warehouse_id)
          .filter((id): id is string => Boolean(id))
      )
    ]
    if (whIds.length > 1) {
      return {
        ok: false,
        message:
          'Egy átadáson belül csak egy raktár tételei lehetnek. Válaszd szét raktár szerint.'
      }
    }
    const warehouseId = whIds[0] ?? defaultWh.id

    // Előleg csak az első sale-nél (ha még nincs link).
    const { count: priorLinks } = await supabase
      .from('cso_sale_links')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('customer_special_order_id', orderId)
    const applyDeposit =
      !priorLinks &&
      !head.sales_order_id &&
      head.deposit_amount != null &&
      Number(head.deposit_amount) > 0
    const depositAmt = applyDeposit ? Math.round(Number(head.deposit_amount)) : 0

    const saleItems: Array<Record<string, unknown>> = []
    const saleFees: Array<Record<string, unknown>> = []
    const itemIdByKey: Array<{ key: string; csoItemId: string }> = []

    for (const it of orderItems) {
      const qty = Math.abs(Number(it.reserved_qty ?? it.qty))
      const price = Math.round(Number(it.unit_price_gross))
      if (it.accessory_id) {
        saleItems.push({
          line_kind: 'product',
          accessory_id: it.accessory_id,
          quantity: qty,
          unit_price_gross: price,
          discount_percentage: 0,
          discount_amount: 0
        })
        itemIdByKey.push({
          key: `product:${it.accessory_id}:${qty}:${price}`,
          csoItemId: it.id
        })
      } else if (it.material_id) {
        saleItems.push({
          line_kind: 'sheet_material',
          sheet_material_id: it.material_id,
          quantity: qty,
          unit_price_gross: price,
          discount_percentage: 0,
          discount_amount: 0
        })
        itemIdByKey.push({
          key: `sheet:${it.material_id}:${qty}:${price}`,
          csoItemId: it.id
        })
      } else if (it.linear_material_id) {
        saleItems.push({
          line_kind: 'linear_material',
          linear_material_id: it.linear_material_id,
          quantity: qty,
          unit_price_gross: price,
          discount_percentage: 0,
          discount_amount: 0
        })
        itemIdByKey.push({
          key: `linear:${it.linear_material_id}:${qty}:${price}`,
          csoItemId: it.id
        })
      } else {
        // Nem katalógus: díjsor (nincs stock) — pénz követhető.
        saleFees.push({
          fee_type_id: null,
          name: it.name,
          quantity: qty,
          unit_price_gross: price,
          tax_rate_percent: 27
        })
        itemIdByKey.push({ key: `fee:${it.id}`, csoItemId: it.id })
      }
    }

    if (!saleItems.length && !saleFees.length) {
      return { ok: false, message: 'Nincs értékesíthető tétel.' }
    }
    // create_sale kötelezően vár legalább 1 termék/anyag sort (díj önmagában nem elég).
    if (!saleItems.length) {
      return {
        ok: false,
        message:
          'Átadáshoz kell legalább egy katalógus termék vagy anyag. A szabad szöveges tételeket kapcsold termékhez.'
      }
    }

    const noteParts = [
      `Ügyfélrendelés ${head.order_number} átadás`,
      head.customer_name ? `· ${head.customer_name}` : '',
      depositAmt > 0 ? `· előleg beszámítva: ${depositAmt} Ft` : ''
    ]
    const note = noteParts.filter(Boolean).join(' ')

    // Claim tételek előbb — dupla kattintás ne hozzon 2 sale-t.
    const claimedIds: string[] = []
    for (const it of orderItems) {
      const { data: claimed } = await supabase
        .from('customer_special_order_items')
        .update({
          status: 'atadva',
          reserved_qty: null,
          updated_at: nowIso()
        })
        .eq('id', it.id)
        .eq('tenant_id', tenantId)
        .eq('status', 'itt_van')
        .select('id')
      if (claimed?.length) claimedIds.push(it.id)
    }
    if (!claimedIds.length) {
      return { ok: false, message: CHANGED_MEANWHILE }
    }
    if (claimedIds.length !== orderItems.length) {
      // Részleges claim — rollback claimed
      for (const id of claimedIds) {
        const orig = orderItems.find((i) => i.id === id)
        await supabase
          .from('customer_special_order_items')
          .update({
            status: 'itt_van',
            reserved_qty: orig?.reserved_qty ?? orig?.qty ?? null,
            updated_at: nowIso()
          })
          .eq('id', id)
          .eq('tenant_id', tenantId)
      }
      return {
        ok: false,
        message: 'Közben változott egy tétel — frissítsd az oldalt, és próbáld újra.'
      }
    }

    let customerId = head.customer_id

    let itemsGross = 0
    for (const it of orderItems) {
      itemsGross += Math.round(
        Math.abs(Number(it.reserved_qty ?? it.qty)) *
          Math.round(Number(it.unit_price_gross))
      )
    }
    const rawDue = Math.max(0, itemsGross - depositAmt)
    const isCash = isCashPaymentMethodName(payMethod.name)
    const estimatedDue =
      isCash && rawDue > 0 ? hungarianCashRound(rawDue) : rawDue

    const rollbackClaim = async () => {
      for (const id of claimedIds) {
        const orig = orderItems.find((i) => i.id === id)
        await supabase
          .from('customer_special_order_items')
          .update({
            status: 'itt_van',
            reserved_qty: orig?.reserved_qty ?? orig?.qty ?? null,
            updated_at: nowIso()
          })
          .eq('id', id)
          .eq('tenant_id', tenantId)
      }
    }

    // create_sale: üres payment + fulfill csak customer_id-val (vendég tiltva).
    // Due=0 / utalás: ha nincs ügyfél, snapshot név+mobilból biztosítunk egyet.
    async function ensureCustomerId(): Promise<string | null> {
      if (customerId) return customerId
      const name = head.customer_name?.trim()
      const mobile = head.customer_mobile?.trim()
      if (!name) return null
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .ilike('name', name)
        .maybeSingle()
      if (existing?.id) {
        customerId = existing.id as string
        if (mobile) {
          await supabase
            .from('customers')
            .update({ mobile, updated_at: nowIso() })
            .eq('id', customerId)
            .eq('tenant_id', tenantId)
        }
        await supabase
          .from('customer_special_orders')
          .update({ customer_id: customerId, updated_at: nowIso() })
          .eq('id', orderId)
          .eq('tenant_id', tenantId)
        return customerId
      }
      const { data: created, error: cErr } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          name,
          mobile: mobile || null
        })
        .select('id')
        .single()
      if (cErr || !created) {
        console.error('handOver ensureCustomer', cErr?.message)
        return null
      }
      customerId = created.id as string
      await supabase
        .from('customer_special_orders')
        .update({ customer_id: customerId, updated_at: nowIso() })
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
      return customerId
    }

    let pPayments: Array<Record<string, unknown>> = []
    let fulfillNow = false
    if (deferred) {
      const ensured = await ensureCustomerId()
      if (!ensured) {
        await rollbackClaim()
        return {
          ok: false,
          message:
            'Utalásos átadáshoz kell ügyfél (név) a rendelésen — hitel / díjbekérő.'
        }
      }
      pPayments = []
      fulfillNow = true
    } else if (estimatedDue <= 0) {
      // Előleg fedezte — fulfill üres paymenttel; ügyfél kell a create_sale vendég-szabály miatt.
      const ensured = await ensureCustomerId()
      if (!ensured) {
        await rollbackClaim()
        return {
          ok: false,
          message:
            'Nincs fennmaradó fizetendő — az átadáshoz kell ügyfélnév a rendelésen.'
        }
      }
      pPayments = []
      fulfillNow = true
    } else {
      pPayments = [
        {
          payment_method_id: paymentMethodId,
          amount: estimatedDue,
          provider_ref: null
        }
      ]
    }

    const { data: saleData, error: saleErr } = await supabase.rpc(
      'create_sale',
      {
        p_warehouse_id: warehouseId,
        p_customer_id: customerId,
        p_channel: 'manual',
        p_note: note,
        p_items: saleItems,
        p_fees: saleFees,
        p_discount: {
          percentage: 0,
          amount: depositAmt
        },
        p_payments: pPayments,
        p_pos_register_id: null,
        p_fulfill_now: fulfillNow
      }
    )

    if (saleErr) {
      console.error('handOver create_sale', saleErr.message)
      for (const id of claimedIds) {
        const orig = orderItems.find((i) => i.id === id)
        await supabase
          .from('customer_special_order_items')
          .update({
            status: 'itt_van',
            reserved_qty: orig?.reserved_qty ?? orig?.qty ?? null,
            updated_at: nowIso()
          })
          .eq('id', id)
          .eq('tenant_id', tenantId)
      }
      return {
        ok: false,
        message: 'Nem sikerült az értékesítést rögzíteni. Próbáld újra.'
      }
    }

    const saleResult = saleData as {
      ok?: boolean
      id?: string
      sale_number?: string
      message?: string
    }
    if (!saleResult?.ok || !saleResult.id) {
      for (const id of claimedIds) {
        const orig = orderItems.find((i) => i.id === id)
        await supabase
          .from('customer_special_order_items')
          .update({
            status: 'itt_van',
            reserved_qty: orig?.reserved_qty ?? orig?.qty ?? null,
            updated_at: nowIso()
          })
          .eq('id', id)
          .eq('tenant_id', tenantId)
      }
      return {
        ok: false,
        message:
          saleResult?.message ??
          'Nem sikerült az értékesítést rögzíteni (készlet / fizetés).'
      }
    }

    const saleId = saleResult.id
    const saleNumber = saleResult.sale_number ?? ''

    await supabase
      .from('sales_orders')
      .update({
        customer_special_order_id: orderId,
        updated_at: nowIso()
      })
      .eq('id', saleId)
      .eq('tenant_id', tenantId)

    await supabase.from('cso_sale_links').insert({
      tenant_id: tenantId,
      customer_special_order_id: orderId,
      sales_order_id: saleId,
      created_by: userId
    })

    await supabase
      .from('customer_special_orders')
      .update({
        sales_order_id: saleId,
        updated_at: nowIso()
      })
      .eq('id', orderId)
      .eq('tenant_id', tenantId)

    // Tétel-szintű link: accessory/material egyezés sorrendben
    const { data: saleLines } = await supabase
      .from('sales_order_items')
      .select(
        'id, item_kind, accessory_id, sheet_material_id, linear_material_id, quantity, unit_price_gross'
      )
      .eq('sales_order_id', saleId)
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)

    if (saleLines?.length) {
      const used = new Set<string>()
      for (const line of saleLines) {
        if (line.item_kind === 'fee') continue
        const match = orderItems.find((it) => {
          if (used.has(it.id)) return false
          const qty = Math.abs(Number(it.reserved_qty ?? it.qty))
          const price = Math.round(Number(it.unit_price_gross))
          if (Number(line.quantity) !== qty) return false
          if (Math.round(Number(line.unit_price_gross)) !== price) return false
          if (
            line.item_kind === 'product' &&
            it.accessory_id &&
            line.accessory_id === it.accessory_id
          ) {
            return true
          }
          if (
            line.item_kind === 'sheet_material' &&
            it.material_id &&
            line.sheet_material_id === it.material_id
          ) {
            return true
          }
          if (
            line.item_kind === 'linear_material' &&
            it.linear_material_id &&
            line.linear_material_id === it.linear_material_id
          ) {
            return true
          }
          return false
        })
        if (match) {
          used.add(match.id)
          await supabase
            .from('sales_order_items')
            .update({ customer_special_order_item_id: match.id })
            .eq('id', line.id)
            .eq('tenant_id', tenantId)
        }
      }
    }
    void itemIdByKey

    createdSales.push({ saleId, saleNumber, orderId })
    revalidatePath(`/ertekesitesek/${saleId}`)
  }

  revalidateCsoMany(orderIds)

  const first = createdSales[0]
  const itemCount = items.length
  const saleLabel =
    createdSales.length === 1
      ? first?.saleNumber
        ? ` Eladás: ${first.saleNumber}.`
        : ''
      : ` ${createdSales.length} értékesítés rögzítve.`

  return {
    ok: true,
    id: input.orderId ?? first?.orderId ?? orderIds[0],
    saleId: first?.saleId,
    saleNumber: first?.saleNumber,
    message: `${itemCount} tétel átadva.${saleLabel}`
  }
}

// ---------------------------------------------------------------------------
// Lemondás / foglalás feloldása / visszaállítás
// ---------------------------------------------------------------------------

export async function cancelSpecialOrderItemAction(input: {
  orderId: string
  itemId: string
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const item = await loadItemWithPo(
    ctx.supabase,
    tenantId,
    input.orderId,
    input.itemId
  )
  if (!item) return { ok: false, message: 'A tétel nem található.' }

  const result = await cancelItemCore(ctx.supabase, tenantId, item)
  if (!result.ok) return { ok: false, message: result.message }

  revalidateCso(input.orderId)
  return {
    ok: true,
    id: input.orderId,
    message: result.message
  }
}

async function cancelItemCore(
  supabase: SupabaseClient,
  tenantId: string,
  item: ItemWithPo
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const rules = csoItemEditRules(item.status, item.poStatus)
  if (!rules.cancel) {
    return { ok: false, message: 'Ez a tétel már nem mondható le.' }
  }

  let note = ''
  if (item.status === 'rendelve' && item.purchase_order_item_id) {
    if (item.poStatus === 'draft') {
      const nextQty = (item.poItemQty ?? 0) - item.qty
      if (nextQty > 0) {
        await supabase
          .from('purchase_order_items')
          .update({ quantity: nextQty, updated_at: nowIso() })
          .eq('id', item.purchase_order_item_id)
          .eq('tenant_id', tenantId)
      } else {
        await supabase
          .from('purchase_order_items')
          .update({ deleted_at: nowIso(), updated_at: nowIso() })
          .eq('id', item.purchase_order_item_id)
          .eq('tenant_id', tenantId)

        if (item.poId) {
          const { count } = await supabase
            .from('purchase_order_items')
            .select('id', { count: 'exact', head: true })
            .eq('purchase_order_id', item.poId)
            .is('deleted_at', null)
          if (!count) {
            await supabase
              .from('purchase_orders')
              .update({ deleted_at: nowIso(), updated_at: nowIso() })
              .eq('id', item.poId)
              .eq('tenant_id', tenantId)
              .eq('status', 'draft')
          }
        }
      }
      note = ' A beszállítói rendelés vázlatából is kikerült.'
    } else if (item.poStatus === 'ordered' || item.poStatus === 'partial') {
      note =
        ' Figyelem: a beszállítói rendelés már elment — ha megérkezik, az áru a polcra kerül.'
    }
  }

  const { data: updated, error } = await supabase
    .from('customer_special_order_items')
    .update({
      status: 'torolve',
      reserved_qty: null,
      updated_at: nowIso()
    })
    .eq('id', item.id)
    .eq('tenant_id', tenantId)
    .eq('status', item.status)
    .select('id')

  if (error) {
    console.error('cancelCsoItem', error.message)
    return { ok: false, message: 'Nem sikerült lemondani a tételt.' }
  }
  if (!updated?.length) return { ok: false, message: CHANGED_MEANWHILE }

  return {
    ok: true,
    message:
      item.status === 'itt_van'
        ? 'Foglalás feloldva — az áru a polcon marad, szabadon eladható.'
        : `Tétel lemondva.${note}`
  }
}

/** Teljes rendelés lemondása — csak ha nincs átadott tétel. */
export async function cancelSpecialOrderAction(input: {
  orderId: string
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const { data: order } = await ctx.supabase
    .from('customer_special_orders')
    .select('id, order_number, deposit_amount, sms_sent_at, status')
    .eq('id', input.orderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!order) return { ok: false, message: 'A rendelés nem található.' }
  if (order.status === 'torolve') {
    return { ok: false, message: 'A rendelés már le van mondva.' }
  }

  const { data: rawItems, error } = await ctx.supabase
    .from('customer_special_order_items')
    .select(
      `
      id, order_id, name, qty, status, accessory_id, purchase_order_item_id,
      purchase_order_items (
        id, quantity, purchase_order_id,
        purchase_orders ( status )
      )
    `
    )
    .eq('order_id', input.orderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  if (error) {
    console.error('cancelCso order load', error.message)
    return { ok: false, message: 'Nem sikerült betölteni a tételeket.' }
  }

  const items: ItemWithPo[] = (rawItems ?? []).map((data) => {
    const poiRaw = data.purchase_order_items as unknown
    const poi = (Array.isArray(poiRaw) ? poiRaw[0] : poiRaw) as
      | {
          id: string
          quantity: number
          purchase_order_id: string
          purchase_orders: { status: string } | { status: string }[] | null
        }
      | null
      | undefined
    const poRaw = poi?.purchase_orders ?? null
    const po = Array.isArray(poRaw) ? poRaw[0] : poRaw
    return {
      id: data.id as string,
      order_id: data.order_id as string,
      name: data.name as string,
      qty: Number(data.qty),
      status: data.status as CsoItemStatus,
      accessory_id: (data.accessory_id as string | null) ?? null,
      purchase_order_item_id:
        (data.purchase_order_item_id as string | null) ?? null,
      poStatus: (po?.status as CsoPoStatus | undefined) ?? null,
      poId: poi?.purchase_order_id ?? null,
      poItemQty: poi ? Number(poi.quantity) : null
    }
  })

  const live = items.filter((i) => i.status !== 'torolve')
  if (live.some((i) => i.status === 'atadva')) {
    return {
      ok: false,
      message:
        'Van már átadott tétel — a rendelést nem lehet egészen lemondani. A maradékot a részleten mondd le.'
    }
  }

  const cancellable = live.filter((i) =>
    Boolean(csoItemEditRules(i.status, i.poStatus).cancel)
  )
  if (!cancellable.length) {
    return { ok: false, message: 'Nincs lemondható tétel.' }
  }

  // Elővalidálás: minden tétel legyen lemondható a jelenlegi állapot szerint.
  for (const it of cancellable) {
    const rules = csoItemEditRules(it.status, it.poStatus)
    if (!rules.cancel) {
      return {
        ok: false,
        message: `„${it.name}” már nem mondható le — frissítsd az oldalt.`
      }
    }
  }

  let done = 0
  const failed: string[] = []
  const warnings: string[] = []

  for (const it of cancellable) {
    // Friss állapot (párhuzamos módosítás ellen).
    const fresh = await loadItemWithPo(
      ctx.supabase,
      tenantId,
      input.orderId,
      it.id
    )
    if (!fresh || fresh.status === 'torolve') continue
    if (fresh.status === 'atadva') {
      failed.push(`${it.name}: közben átadták`)
      continue
    }
    const res = await cancelItemCore(ctx.supabase, tenantId, fresh)
    if (!res.ok) {
      failed.push(`${it.name}: ${res.message}`)
      continue
    }
    done += 1
    if (res.message.includes('Figyelem')) warnings.push(it.name)
  }

  revalidateCso(input.orderId)

  if (!done && failed.length) {
    return { ok: false, message: failed.join(' · ') }
  }
  if (!done) return { ok: false, message: CHANGED_MEANWHILE }

  const parts = [`${order.order_number as string} lemondva (${done} tétel).`]
  if (Number(order.deposit_amount) > 0) {
    parts.push(
      `Előleg ${Number(order.deposit_amount).toLocaleString('hu-HU')} Ft — kézzel add vissza.`
    )
  }
  if (order.sms_sent_at) {
    parts.push('Az ügyfél már kapott „átveheted” SMS-t.')
  }
  if (warnings.length) {
    parts.push(
      `Elküldött beszállítói rendelés: ${warnings.join(', ')} — ha megjön, polcra kerül.`
    )
  }
  if (failed.length) {
    parts.push(`Nem sikerült: ${failed.join('; ')}`)
  }

  return { ok: true, id: input.orderId, message: parts.join(' ') }
}

/** Összes lemondott tétel visszaállítása „Felvéve”-re. */
export async function restoreSpecialOrderAction(input: {
  orderId: string
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const { data: updated, error } = await ctx.supabase
    .from('customer_special_order_items')
    .update({
      status: 'felveve',
      purchase_order_item_id: null,
      reserved_qty: null,
      reserved_at: null,
      updated_at: nowIso()
    })
    .eq('order_id', input.orderId)
    .eq('tenant_id', tenantId)
    .eq('status', 'torolve')
    .is('deleted_at', null)
    .select('id')

  if (error) {
    console.error('restoreCsoOrder', error.message)
    return { ok: false, message: 'Nem sikerült visszaállítani a rendelést.' }
  }
  if (!updated?.length) {
    return { ok: false, message: 'Nincs visszaállítható (lemondott) tétel.' }
  }

  revalidateCso(input.orderId)
  return {
    ok: true,
    id: input.orderId,
    message: `${updated.length} tétel visszaállítva „Felvéve” státuszba — újra le kell adni.`
  }
}

/** Lemondott rendelés elrejtése a listáról (soft delete a fejen). */
export async function hideSpecialOrderAction(input: {
  orderId: string
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const { data: order } = await ctx.supabase
    .from('customer_special_orders')
    .select('id, status')
    .eq('id', input.orderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!order) return { ok: false, message: 'A rendelés nem található.' }
  if (order.status !== 'torolve') {
    return {
      ok: false,
      message: 'Csak teljesen lemondott rendelést lehet elrejteni.'
    }
  }

  const { data: updated, error } = await ctx.supabase
    .from('customer_special_orders')
    .update({ deleted_at: nowIso(), updated_at: nowIso() })
    .eq('id', input.orderId)
    .eq('tenant_id', tenantId)
    .eq('status', 'torolve')
    .is('deleted_at', null)
    .select('id')

  if (error || !updated?.length) {
    console.error('hideCso', error?.message)
    return { ok: false, message: 'Nem sikerült elrejteni a rendelést.' }
  }

  revalidateCso(input.orderId)
  return {
    ok: true,
    id: input.orderId,
    message: 'Rendelés elrejtve a listáról. A szám továbbra is foglalt.'
  }
}

export async function restoreSpecialOrderItemAction(input: {
  orderId: string
  itemId: string
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const { data: updated, error } = await ctx.supabase
    .from('customer_special_order_items')
    .update({
      status: 'felveve',
      purchase_order_item_id: null,
      reserved_qty: null,
      reserved_at: null,
      updated_at: nowIso()
    })
    .eq('id', input.itemId)
    .eq('order_id', input.orderId)
    .eq('tenant_id', tenantId)
    .eq('status', 'torolve')
    .is('deleted_at', null)
    .select('id')

  if (error) {
    console.error('restoreCsoItem', error.message)
    return { ok: false, message: 'Nem sikerült visszaállítani a tételt.' }
  }
  if (!updated?.length) return { ok: false, message: CHANGED_MEANWHILE }

  revalidateCso(input.orderId)
  return {
    ok: true,
    id: input.orderId,
    message: 'Tétel visszaállítva „Felvéve” státuszba — újra le kell adni.'
  }
}

// ---------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------

export async function previewSpecialOrderReadySmsAction(input: {
  orderId?: string
  orderIds?: string[]
}): Promise<
  | { ok: true; candidates: CsoReadySmsCandidate[] }
  | { ok: false; message: string }
> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const ids = [
    ...new Set(
      [
        ...(input.orderId ? [input.orderId] : []),
        ...(input.orderIds ?? [])
      ].filter(Boolean)
    )
  ]
  if (!ids.length) {
    return { ok: false, message: 'Nincs kiválasztott rendelés.' }
  }

  const tenantId = ctx.user.tenantId!
  const [template, companyName] = await Promise.all([
    getTenantSmsTemplate(ctx.supabase, tenantId, CSO_READY_TEMPLATE_KEY),
    loadCompanyNameForSms(ctx.supabase, tenantId)
  ])

  const candidates: CsoReadySmsCandidate[] = []
  for (const orderId of ids) {
    candidates.push(
      await buildCsoReadySmsCandidate(
        ctx.supabase,
        tenantId,
        orderId,
        template,
        companyName
      )
    )
  }

  return { ok: true, candidates }
}

export async function sendSpecialOrderReadySmsAction(input: {
  orderId?: string
  orderIds?: string[]
}): Promise<CsoActionResult> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const ids = [
    ...new Set(
      [
        ...(input.orderId ? [input.orderId] : []),
        ...(input.orderIds ?? [])
      ].filter(Boolean)
    )
  ]
  if (!ids.length) {
    return { ok: false, message: 'Nincs kiválasztott rendelés.' }
  }

  const notes: string[] = []
  let okCount = 0
  for (const orderId of ids) {
    const note = await trySendReadySms(
      ctx.supabase,
      ctx.user.tenantId!,
      orderId,
      { force: true, userId: ctx.user.id }
    )
    if (note.startsWith('SMS elküldve')) {
      okCount += 1
      notes.push(note)
    } else if (note) {
      notes.push(note)
    }
    revalidateCso(orderId)
  }

  if (!okCount) {
    return {
      ok: false,
      message: notes[0] || 'Nincs átvehető tétel.'
    }
  }
  return {
    ok: true,
    id: ids[0],
    message: notes.join(' ')
  }
}

/** Beérkezés után — részleges beérkezést is kezel (SQL). SMS nem auto — kézi dialógus. */
export async function syncSpecialOrdersAfterGoodsReceipt(
  receiptId: string
): Promise<{ updatedOrders: number; message?: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) {
    return { updatedOrders: 0, message: ctx.message }
  }

  // App-oldali backfill: null PO-linkű rendelve tételek → accessory egyezés a beérkezés PO-soraival
  await backfillCsoPoLinksForReceipt(ctx.supabase, ctx.user.tenantId!, receiptId)

  const { data, error } = await ctx.supabase.rpc(
    'mark_special_order_items_arrived_for_receipt',
    { p_receipt_id: receiptId }
  )
  if (error) {
    console.error('syncSpecialOrdersAfterGoodsReceipt', error.message)
    return {
      updatedOrders: 0,
      message: `Ügyfélrendelés státusz nem frissült: ${error.message}`
    }
  }

  const orderIds = ((data ?? []) as unknown[])
    .map((row) =>
      typeof row === 'string'
        ? row
        : (Object.values(row as Record<string, unknown>)[0] as string)
    )
    .filter(Boolean)

  for (const orderId of new Set(orderIds)) {
    revalidateCso(orderId)
  }

  revalidatePath('/ugyfelrendelesek/varolista')

  const n = new Set(orderIds).size
  return {
    updatedOrders: n,
    message:
      n > 0
        ? `${n} ügyfélrendelés: Itt van. Küldj SMS-t a rendelésről / várólistáról.`
        : undefined
  }
}

/** Ha a lead nem írta a purchase_order_item_id-t, accessory alapján pótoljuk. */
async function backfillCsoPoLinksForReceipt(
  supabase: SupabaseClient,
  tenantId: string,
  receiptId: string
) {
  const { data: gri } = await supabase
    .from('goods_receipt_items')
    .select(
      `
      purchase_order_item_id,
      quantity_received,
      purchase_order_items ( id, accessory_id )
    `
    )
    .eq('goods_receipt_id', receiptId)
    .is('deleted_at', null)
    .gt('quantity_received', 0)

  for (const row of gri ?? []) {
    if (!row.purchase_order_item_id) continue
    const poiRaw = row.purchase_order_items as
      | { id: string; accessory_id: string }
      | { id: string; accessory_id: string }[]
      | null
    const poi = Array.isArray(poiRaw) ? poiRaw[0] : poiRaw
    const accessoryId = poi?.accessory_id
    if (!accessoryId) continue

    await supabase
      .from('customer_special_order_items')
      .update({
        purchase_order_item_id: row.purchase_order_item_id,
        updated_at: nowIso()
      })
      .eq('tenant_id', tenantId)
      .eq('accessory_id', accessoryId)
      .eq('status', 'rendelve')
      .is('purchase_order_item_id', null)
      .is('deleted_at', null)
  }
}

async function loadCompanyNameForSms(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string> {
  const { data } = await supabase
    .from('tenant_companies')
    .select('name')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data?.name?.trim() || 'Turinova'
}

async function buildCsoReadySmsCandidate(
  supabase: SupabaseClient,
  tenantId: string,
  orderId: string,
  template: string,
  companyName: string
): Promise<CsoReadySmsCandidate> {
  const { data: order } = await supabase
    .from('customer_special_orders')
    .select(
      'id, order_number, customer_id, customer_name, customer_mobile, sms_sent_at'
    )
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!order) {
    return {
      orderId,
      orderNumber: '—',
      customerName: '—',
      mobile: null,
      previewBody: '',
      readyCount: 0,
      waitingCount: 0,
      eligible: false,
      skipReason: 'not_ready',
      alreadySentAt: null
    }
  }

  const { data: items } = await supabase
    .from('customer_special_order_items')
    .select('status, qty, unit_price_gross')
    .eq('order_id', orderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  const activeItems = (items ?? []).filter(
    (i) => (i.status as CsoItemStatus) !== 'torolve'
  )
  const statuses = activeItems.map((i) => i.status as CsoItemStatus)
  const readyCount = statuses.filter((s) => s === 'itt_van').length
  const waitingCount = statuses.filter(
    (s) => s === 'felveve' || s === 'rendelve'
  ).length
  const totalAmount = activeItems.reduce((sum, i) => {
    const price = Number(i.unit_price_gross)
    const qty = Number(i.qty)
    if (!Number.isFinite(price) || !Number.isFinite(qty)) return sum
    return sum + Math.round(price * qty)
  }, 0)

  const mobile = normalizeE164(order.customer_mobile as string)
  const share = await ensureOrderShareLink({
    supabase,
    tenantId,
    kind: 'cso',
    refId: orderId
  })
  const previewBody = renderSmsTemplate(template, {
    customer_name: (order.customer_name as string) || '',
    order_number: (order.order_number as string) || '',
    company_name: companyName,
    ready_count: readyCount,
    waiting_count: waitingCount,
    total_amount: formatSmsAmount(totalAmount),
    status_url: share?.url ?? ''
  })

  let skipReason: SmsSkipReason | null = null
  if (!readyCount) skipReason = 'not_ready'
  else if (!mobile) skipReason = 'bad_phone'
  else if (!previewBody.trim()) skipReason = 'empty_body'

  return {
    orderId,
    orderNumber: (order.order_number as string) || '—',
    customerName: (order.customer_name as string) || '—',
    mobile,
    previewBody,
    readyCount,
    waitingCount,
    eligible: skipReason === null,
    skipReason,
    alreadySentAt: (order.sms_sent_at as string | null) ?? null
  }
}

/**
 * Kézi küldés (force): legalább 1 átvehető tétel kell.
 * Auto path megszűnt — csak explicit dialógus után hívjuk.
 */
async function trySendReadySms(
  supabase: SupabaseClient,
  tenantId: string,
  orderId: string,
  opts: { force?: boolean; userId?: string } = {}
): Promise<string> {
  const { data: order } = await supabase
    .from('customer_special_orders')
    .select(
      'id, order_number, customer_id, customer_name, customer_mobile, sms_sent_at'
    )
    .eq('id', orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!order) return ''
  if (order.sms_sent_at && !opts.force) return ''

  const { data: items } = await supabase
    .from('customer_special_order_items')
    .select('status, qty, unit_price_gross')
    .eq('order_id', orderId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)

  const activeItems = (items ?? []).filter(
    (i) => (i.status as CsoItemStatus) !== 'torolve'
  )
  const statuses = activeItems.map((i) => i.status as CsoItemStatus)
  const ready = statuses.filter((s) => s === 'itt_van').length
  const waiting = statuses.filter(
    (s) => s === 'felveve' || s === 'rendelve'
  ).length
  const totalAmount = activeItems.reduce((sum, i) => {
    const price = Number(i.unit_price_gross)
    const qty = Number(i.qty)
    if (!Number.isFinite(price) || !Number.isFinite(qty)) return sum
    return sum + Math.round(price * qty)
  }, 0)

  if (!ready) return opts.force ? 'Nincs átvehető („Itt van”) tétel.' : ''
  if (waiting && !opts.force) {
    return `SMS még nem ment ki — ${waiting} tétel még úton van.`
  }

  const to = normalizeE164(order.customer_mobile as string)
  if (!to) {
    await insertSmsSendEvent(supabase, {
      tenantId,
      customerSpecialOrderId: orderId,
      customerId: (order.customer_id as string | null) ?? null,
      templateKey: CSO_READY_TEMPLATE_KEY,
      status: 'skipped',
      skipReason: 'bad_phone',
      createdBy: opts.userId ?? null
    })
    return 'SMS kihagyva: érvénytelen telefonszám.'
  }

  const [template, companyName, share] = await Promise.all([
    getTenantSmsTemplate(supabase, tenantId, CSO_READY_TEMPLATE_KEY),
    loadCompanyNameForSms(supabase, tenantId),
    ensureOrderShareLink({
      supabase,
      tenantId,
      kind: 'cso',
      refId: orderId,
      userId: opts.userId
    })
  ])

  const body = renderSmsTemplate(template, {
    customer_name: (order.customer_name as string) || '',
    order_number: (order.order_number as string) || '',
    company_name: companyName,
    ready_count: ready,
    waiting_count: waiting,
    total_amount: formatSmsAmount(totalAmount),
    status_url: share?.url ?? ''
  })

  if (!body.trim()) {
    await insertSmsSendEvent(supabase, {
      tenantId,
      customerSpecialOrderId: orderId,
      customerId: (order.customer_id as string | null) ?? null,
      templateKey: CSO_READY_TEMPLATE_KEY,
      toE164: to,
      status: 'skipped',
      skipReason: 'empty_body',
      createdBy: opts.userId ?? null
    })
    return 'SMS kihagyva: üres sablon.'
  }

  const res = await sendTwilioSms({ toE164: to, body })
  if (!res.ok) {
    await insertSmsSendEvent(supabase, {
      tenantId,
      customerSpecialOrderId: orderId,
      customerId: (order.customer_id as string | null) ?? null,
      templateKey: CSO_READY_TEMPLATE_KEY,
      toE164: to,
      bodyLength: res.bodyLength,
      segments: res.segments,
      status: 'failed',
      errorCode: res.error.slice(0, 200),
      createdBy: opts.userId ?? null
    })
    return `SMS sikertelen: ${res.error}`
  }

  await supabase
    .from('customer_special_orders')
    .update({ sms_sent_at: nowIso(), updated_at: nowIso() })
    .eq('id', orderId)
    .eq('tenant_id', tenantId)

  await insertSmsSendEvent(supabase, {
    tenantId,
    customerSpecialOrderId: orderId,
    customerId: (order.customer_id as string | null) ?? null,
    templateKey: CSO_READY_TEMPLATE_KEY,
    toE164: to,
    bodyLength: res.bodyLength,
    segments: res.segments || smsSegments(body),
    providerSid: res.sid,
    status: 'sent',
    createdBy: opts.userId ?? null
  })

  return 'SMS elküldve.'
}
