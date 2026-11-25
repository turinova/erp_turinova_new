'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import {
  buildOrderTextBlocks,
  type OrderTextBlock,
  type OrderTextLine,
  type OrderTextSupplier
} from '@/lib/manual-orders/order-text'
import {
  addMoDepositSchema,
  createMoSchema,
  moItemInputSchema,
  updateMoHeaderSchema,
  type AddMoDepositInput,
  type CreateMoInput,
  type MoItemInput,
  type UpdateMoHeaderInput
} from '@/lib/manual-orders/parse'
import {
  loadSupplierInfo,
  loadSupplierSkus,
  searchManualOrders,
  type MoSearchHit
} from '@/lib/manual-orders/queries'
import { moSmsCounts, type MoSmsCounts, type SmsCountItem } from '@/lib/manual-orders/sms-counts'
import { buildSupplierProductUrl } from '@/lib/suppliers/order-channels'
import {
  MO_DEPOSIT_METHOD_LABEL,
  MO_ITEM_STATUSES,
  moLineGross,
  type MoDepositMethod,
  type MoItemStatus,
  type MoSmsCandidate
} from '@/lib/manual-orders/types'
import { orderStatusAbsoluteUrl } from '@/lib/order-status/format'
import { ensureOrderShareLink, revokeOrderShareLinks } from '@/lib/order-status/links'
import { sendPlatformSms } from '@/lib/sms/send'
import { getTenantSmsTemplate, insertSmsSendEvent } from '@/lib/sms/templates'
import { normalizeE164, renderSmsTemplate, smsSegments } from '@/lib/sms/text'
import { MANUAL_ORDER_READY_TEMPLATE_KEY } from '@/lib/sms/types'
import { requireWritableTenant } from '@/lib/tenancy/writable-context'

export type MoActionResult =
  | { ok: true; id?: string; orderNumber?: string; message?: string; changed?: number }
  | { ok: false; message: string; fieldErrors?: Record<string, string> }

const LIST_PATH = '/kezi-rendelesek'
const QUEUE_PATH = '/kezi-varolista'

function revalidateMo(orderIds: string[] = []) {
  revalidatePath(LIST_PATH)
  revalidatePath(QUEUE_PATH)
  for (const id of new Set(orderIds)) revalidatePath(`${LIST_PATH}/${id}`)
}

function fieldErrorsFromZod(issues: { path: (string | number)[]; message: string }[]) {
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

type Ctx = Extract<Awaited<ReturnType<typeof requireWritableTenant>>, { ok: true }>

/** Írható tenant + a „Kézi rendelések” add-on oldalai engedélyezve a usernek. */
async function requireMoContext(): Promise<Ctx | { ok: false; message: string }> {
  const ctx = await requireWritableTenant()
  if (!ctx.ok) return ctx
  const pages = ctx.user.allowedPages
  if (!pages.includes(LIST_PATH) && !pages.includes(QUEUE_PATH)) {
    return { ok: false, message: 'A Kézi rendelések modul nincs bekapcsolva, vagy nincs hozzá jogod.' }
  }
  return ctx
}

function actorLabel(ctx: Ctx): string {
  return ctx.user.displayName?.trim() || ctx.user.email
}

async function logEvent(
  ctx: Ctx,
  orderId: string,
  kind: 'created' | 'sms' | 'deposit' | 'deposit_void' | 'edited' | 'items_added',
  extra: { itemCount?: number; detail?: string } = {}
) {
  const { error } = await ctx.supabase.from('manual_order_events').insert({
    tenant_id: ctx.user.tenantId!,
    order_id: orderId,
    kind,
    item_count: extra.itemCount ?? null,
    detail: extra.detail ?? null,
    actor_label: actorLabel(ctx),
    created_by: ctx.user.id
  })
  if (error) console.error('manual_order_events insert', error.message)
}

function itemRows(tenantId: string, orderId: string, items: MoItemInput[], startSort: number) {
  return items.map((it, index) => ({
    tenant_id: tenantId,
    order_id: orderId,
    name: it.name,
    sku: it.sku ?? null,
    qty: it.qty,
    unit_shortform: it.unitShortform || 'db',
    unit_price_gross: it.unitPriceGross ?? null,
    accessory_id: it.accessoryId ?? null,
    supplier_id: it.supplierId,
    note: it.note ?? null,
    status: 'nyitott',
    sort_order: startSort + index
  }))
}

/** Meglévő ügyfél: id → nincs módosítás. Új: telefonszám egyezés, különben létrehozás. */
async function resolveCustomerId(
  ctx: Ctx,
  input: { customerId?: string | null; customerName: string; customerMobile?: string | null }
): Promise<string | null> {
  const tenantId = ctx.user.tenantId!
  if (input.customerId) return input.customerId

  const mobile = input.customerMobile?.trim() || null
  if (mobile) {
    const { data: byMobile } = await ctx.supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('deleted_at', null)
      .eq('mobile', mobile)
      .limit(1)
    if (byMobile?.[0]?.id) return byMobile[0].id as string
  }

  const { data: created, error } = await ctx.supabase
    .from('customers')
    .insert({
      tenant_id: tenantId,
      name: input.customerName,
      mobile,
      sms_notification: Boolean(mobile)
    })
    .select('id')
    .single()
  if (error || !created) {
    console.error('manual order customer create', error?.message)
    return null
  }
  return created.id as string
}

// ---------------------------------------------------------------------------
// Létrehozás
// ---------------------------------------------------------------------------

export async function createManualOrderAction(input: CreateMoInput): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }

  const parsed = createMoSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a kiemelt mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const d = parsed.data
  const tenantId = ctx.user.tenantId!

  const customerId = await resolveCustomerId(ctx, d)
  if (!customerId) return { ok: false, message: 'Nem sikerült a vevőt menteni.' }

  let order: { id: string; order_number: string } | null = null
  let lastErr: string | null = null
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    const { data: num, error: numErr } = await ctx.supabase.rpc('generate_manual_order_number', {
      p_tenant_id: tenantId
    })
    if (numErr || !num) {
      console.error('generate_manual_order_number', numErr?.message)
      return { ok: false, message: 'Nem sikerült rendelésszámot generálni.' }
    }
    const res = await ctx.supabase
      .from('manual_orders')
      .insert({
        tenant_id: tenantId,
        order_number: num as string,
        customer_id: customerId,
        customer_name: d.customerName,
        customer_mobile: d.customerMobile ?? null,
        promised_date: d.promisedDate ?? null,
        note: d.note ?? null,
        created_by: ctx.user.id,
        created_by_label: actorLabel(ctx)
      })
      .select('id, order_number')
      .single()
    order = (res.data as { id: string; order_number: string } | null) ?? null
    lastErr = res.error?.message ?? null
    if (res.error && res.error.code !== '23505') break
  }
  if (!order) {
    console.error('manual order insert', lastErr)
    return { ok: false, message: 'Nem sikerült menteni a rendelést.' }
  }

  const { data: inserted, error: iErr } = await ctx.supabase
    .from('manual_order_items')
    .insert(itemRows(tenantId, order.id, d.items, 0))
    .select('id')
  if (iErr) {
    console.error('manual order items insert', iErr.message)
    await ctx.supabase.from('manual_orders').update({ deleted_at: nowIso() }).eq('id', order.id)
    return { ok: false, message: 'Nem sikerült menteni a tételeket.' }
  }

  await logEvent(ctx, order.id, 'created', { itemCount: d.items.length })

  if (d.alreadyOrdered && inserted?.length) {
    const { error } = await ctx.supabase.rpc('manual_order_items_set_status', {
      p_item_ids: inserted.map((r) => r.id as string),
      p_status: 'megrendelve',
      p_actor_label: actorLabel(ctx)
    })
    if (error) console.error('manual order already ordered', error.message)
  }

  if (d.depositAmount && d.depositAmount > 0) {
    const { error } = await ctx.supabase.from('manual_order_deposits').insert({
      tenant_id: tenantId,
      order_id: order.id,
      amount: d.depositAmount,
      method: d.depositMethod,
      created_by: ctx.user.id,
      created_by_label: actorLabel(ctx)
    })
    if (error) console.error('manual order deposit', error.message)
    else await logEvent(ctx, order.id, 'deposit', { detail: `${Math.round(d.depositAmount)} Ft` })
  }

  revalidateMo([order.id])
  return { ok: true, id: order.id, orderNumber: order.order_number }
}

// ---------------------------------------------------------------------------
// Szerkesztés
// ---------------------------------------------------------------------------

export async function updateManualOrderHeaderAction(
  input: { orderId: string } & UpdateMoHeaderInput
): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const parsed = updateMoHeaderSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a kiemelt mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const d = parsed.data
  const { error } = await ctx.supabase
    .from('manual_orders')
    .update({
      customer_name: d.customerName,
      customer_mobile: d.customerMobile ?? null,
      promised_date: d.promisedDate ?? null,
      note: d.note ?? null,
      updated_at: nowIso()
    })
    .eq('id', input.orderId)
    .eq('tenant_id', ctx.user.tenantId!)
  if (error) {
    console.error('updateManualOrderHeader', error.message)
    return { ok: false, message: 'Nem sikerült menteni.' }
  }
  await logEvent(ctx, input.orderId, 'edited', { detail: 'Adatok módosítva' })
  revalidateMo([input.orderId])
  return { ok: true }
}

export async function addManualOrderItemsAction(input: {
  orderId: string
  items: MoItemInput[]
}): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const parsed = moItemInputSchema.array().min(1, 'Legalább egy tétel kell.').safeParse(input.items)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a kiemelt mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const tenantId = ctx.user.tenantId!
  const { count } = await ctx.supabase
    .from('manual_order_items')
    .select('id', { count: 'exact', head: true })
    .eq('order_id', input.orderId)
    .eq('tenant_id', tenantId)
  const { error } = await ctx.supabase
    .from('manual_order_items')
    .insert(itemRows(tenantId, input.orderId, parsed.data, count ?? 0))
  if (error) {
    console.error('addManualOrderItems', error.message)
    return { ok: false, message: 'Nem sikerült hozzáadni a tételt.' }
  }
  await logEvent(ctx, input.orderId, 'items_added', { itemCount: parsed.data.length })
  revalidateMo([input.orderId])
  return { ok: true }
}

export async function updateManualOrderItemAction(input: {
  itemId: string
  item: MoItemInput
}): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const parsed = moItemInputSchema.safeParse(input.item)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a kiemelt mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const d = parsed.data
  const { data: current } = await ctx.supabase
    .from('manual_order_items')
    .select('status, name, qty, unit_shortform, supplier_id')
    .eq('id', input.itemId)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
    .maybeSingle()
  if (!current) return { ok: false, message: 'A tétel nem található.' }
  if (current.status === 'atadva' || current.status === 'torolve') {
    return { ok: false, message: 'Átadott vagy törölt tétel nem módosítható.' }
  }
  if (
    current.status === 'megerkezett' &&
    (current.name !== d.name ||
      Number(current.qty) !== d.qty ||
      current.unit_shortform !== (d.unitShortform || 'db') ||
      current.supplier_id !== d.supplierId)
  ) {
    return { ok: false, message: 'Megjött tételnél csak az ár és a megjegyzés módosítható.' }
  }
  const { data, error } = await ctx.supabase
    .from('manual_order_items')
    .update({
      name: d.name,
      sku: d.sku ?? null,
      qty: d.qty,
      unit_shortform: d.unitShortform || 'db',
      unit_price_gross: d.unitPriceGross ?? null,
      supplier_id: d.supplierId,
      note: d.note ?? null,
      updated_at: nowIso()
    })
    .eq('id', input.itemId)
    .eq('tenant_id', ctx.user.tenantId!)
    .select('order_id')
    .maybeSingle()
  if (error || !data) {
    console.error('updateManualOrderItem', error?.message)
    return { ok: false, message: 'Nem sikerült menteni a tételt.' }
  }
  await logEvent(ctx, data.order_id as string, 'edited', { detail: `Tétel módosítva: ${d.name}` })
  revalidateMo([data.order_id as string])
  return { ok: true }
}

/**
 * Részszállítás: a megrendelt tétel kettéválik — az eredeti `arrivedQty`-re csökken (ezt jelöli
 * a hívó megjöttnek), a maradék új „Megrendelve” tételként úton marad.
 */
export async function splitManualItemAction(input: {
  itemId: string
  arrivedQty: number
}): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!
  const { data: cur } = await ctx.supabase
    .from('manual_order_items')
    .select(
      'order_id, name, sku, qty, unit_shortform, unit_price_gross, accessory_id, supplier_id, note, status, ordered_at, ordered_by_label, sort_order'
    )
    .eq('id', input.itemId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!cur) return { ok: false, message: 'A tétel nem található.' }
  if (cur.status !== 'megrendelve') return { ok: false, message: 'Csak megrendelt tétel bontható.' }
  const total = Number(cur.qty)
  const arrived = Math.round(Number(input.arrivedQty) * 1000) / 1000
  if (!(arrived > 0) || arrived >= total) {
    return { ok: false, message: `A megjött mennyiség 0 és ${total} közé essen.` }
  }
  const rest = Math.round((total - arrived) * 1000) / 1000

  const { data: ins, error: insErr } = await ctx.supabase
    .from('manual_order_items')
    .insert({
      tenant_id: tenantId,
      order_id: cur.order_id,
      name: cur.name,
      sku: cur.sku,
      qty: rest,
      unit_shortform: cur.unit_shortform,
      unit_price_gross: cur.unit_price_gross,
      accessory_id: cur.accessory_id,
      supplier_id: cur.supplier_id,
      note: cur.note,
      status: 'megrendelve',
      ordered_at: cur.ordered_at,
      ordered_by_label: cur.ordered_by_label,
      sort_order: cur.sort_order
    })
    .select('id')
    .single()
  if (insErr || !ins) {
    console.error('splitManualItem insert', insErr?.message)
    return { ok: false, message: 'Nem sikerült bontani a tételt.' }
  }
  const { error: upErr } = await ctx.supabase
    .from('manual_order_items')
    .update({ qty: arrived, updated_at: nowIso() })
    .eq('id', input.itemId)
    .eq('tenant_id', tenantId)
  if (upErr) {
    console.error('splitManualItem update', upErr.message)
    await ctx.supabase
      .from('manual_order_items')
      .update({ deleted_at: nowIso() })
      .eq('id', ins.id)
      .eq('tenant_id', tenantId)
    return { ok: false, message: 'Nem sikerült bontani a tételt.' }
  }
  await logEvent(ctx, cur.order_id as string, 'edited', {
    detail: `Részszállítás: ${cur.name} — ${arrived} megjött, ${rest} ${cur.unit_shortform} úton marad`
  })
  revalidateMo([cur.order_id as string])
  return { ok: true, id: ins.id as string }
}

// ---------------------------------------------------------------------------
// Vevő csere + számlázási adatok (az ügyfél törzsön)
// ---------------------------------------------------------------------------

export async function setManualOrderCustomerAction(input: {
  orderId: string
  customerId: string
}): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!
  const { data: c } = await ctx.supabase
    .from('customers')
    .select('id, name, mobile')
    .eq('id', input.customerId)
    .eq('tenant_id', tenantId)
    .is('deleted_at', null)
    .maybeSingle()
  if (!c) return { ok: false, message: 'Az ügyfél nem található.' }
  const { error } = await ctx.supabase
    .from('manual_orders')
    .update({
      customer_id: c.id,
      customer_name: c.name,
      customer_mobile: c.mobile ?? null,
      updated_at: nowIso()
    })
    .eq('id', input.orderId)
    .eq('tenant_id', tenantId)
  if (error) {
    console.error('setManualOrderCustomer', error.message)
    return { ok: false, message: 'Nem sikerült a vevőt cserélni.' }
  }
  await logEvent(ctx, input.orderId, 'edited', { detail: `Vevő cserélve: ${c.name}` })
  revalidateMo([input.orderId])
  return { ok: true }
}

export type MoBillingInput = {
  name: string
  postalCode: string
  city: string
  street: string
  houseNumber: string
  taxNumber: string
}

export async function updateManualOrderBillingAction(input: {
  orderId: string
  billing: MoBillingInput
}): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!
  const b = input.billing
  const t = (v: string) => v.trim().slice(0, 200) || null
  if (!t(b.name)) return { ok: false, message: 'Add meg a számlázási nevet.', fieldErrors: { name: 'Kötelező.' } }
  const { data: order } = await ctx.supabase
    .from('manual_orders')
    .select('customer_id')
    .eq('id', input.orderId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!order?.customer_id) return { ok: false, message: 'A rendeléshez nincs ügyfél rendelve.' }
  const { error } = await ctx.supabase
    .from('customers')
    .update({
      billing_name: t(b.name),
      billing_postal_code: t(b.postalCode),
      billing_city: t(b.city),
      billing_street: t(b.street),
      billing_house_number: t(b.houseNumber),
      billing_tax_number: t(b.taxNumber),
      updated_at: nowIso()
    })
    .eq('id', order.customer_id)
    .eq('tenant_id', tenantId)
  if (error) {
    console.error('updateManualOrderBilling', error.message)
    return { ok: false, message: 'Nem sikerült menteni a számlázási adatokat.' }
  }
  await logEvent(ctx, input.orderId, 'edited', { detail: 'Számlázási adatok módosítva' })
  revalidateMo([input.orderId])
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Tömeges státusz
// ---------------------------------------------------------------------------

async function setStatus(
  ctx: Ctx,
  itemIds: string[],
  status: MoItemStatus
): Promise<{ ok: true; orderIds: string[]; changed: number } | { ok: false; message: string }> {
  const { data, error } = await ctx.supabase.rpc('manual_order_items_set_status', {
    p_item_ids: itemIds,
    p_status: status,
    p_actor_label: actorLabel(ctx)
  })
  if (error) {
    console.error('manual_order_items_set_status', error.message)
    return { ok: false, message: 'Nem sikerült a státuszt módosítani.' }
  }
  const rows = (data ?? []) as { order_id: string; changed: number }[]
  return {
    ok: true,
    orderIds: rows.map((r) => r.order_id),
    changed: rows.reduce((s, r) => s + Number(r.changed || 0), 0)
  }
}

export async function setManualItemsStatusAction(input: {
  itemIds: string[]
  status: MoItemStatus
}): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!(MO_ITEM_STATUSES as readonly string[]).includes(input.status)) {
    return { ok: false, message: 'Ismeretlen státusz.' }
  }
  if (input.itemIds.length === 0) return { ok: false, message: 'Nincs kijelölt tétel.' }
  const res = await setStatus(ctx, input.itemIds, input.status)
  if (!res.ok) return res
  revalidateMo(res.orderIds)
  return { ok: true, changed: res.changed }
}

export async function cancelManualOrderAction(input: { orderId: string }): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const { data } = await ctx.supabase
    .from('manual_order_items')
    .select('id, status')
    .eq('order_id', input.orderId)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('deleted_at', null)
  const ids = (data ?? [])
    .filter((i) => i.status !== 'atadva' && i.status !== 'torolve')
    .map((i) => i.id as string)
  if (ids.length === 0) return { ok: false, message: 'Nincs lemondható tétel.' }
  const res = await setStatus(ctx, ids, 'torolve')
  if (!res.ok) return res
  if (!(data ?? []).some((i) => i.status === 'atadva')) {
    await revokeOrderShareLinks({
      supabase: ctx.supabase,
      tenantId: ctx.user.tenantId!,
      kind: 'manual',
      refId: input.orderId
    })
  }
  revalidateMo([input.orderId])
  return { ok: true, changed: res.changed }
}

// ---------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------

/** Cég alap rendelési e-mail bevezetője; hiányzó oszlopnál (migráció előtt) null. */
async function loadCompanyPoIntro(supabase: SupabaseClient, tenantId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('tenant_companies')
    .select('po_email_intro')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) return null
  return (data?.po_email_intro as string | null)?.trim() || null
}

async function loadCompanyName(supabase: SupabaseClient, tenantId: string): Promise<string> {
  const { data } = await supabase
    .from('tenant_companies')
    .select('name')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  return data?.name?.trim() || ''
}

type OrderForSms = {
  id: string
  order_number: string
  customer_id: string | null
  customer_name: string
  customer_mobile: string | null
  sms_sent_at: string | null
  items: SmsCountItem[]
}

async function loadOrdersForSms(
  supabase: SupabaseClient,
  tenantId: string,
  orderIds: string[]
): Promise<OrderForSms[]> {
  if (orderIds.length === 0) return []
  const { data } = await supabase
    .from('manual_orders')
    .select(
      'id, order_number, customer_id, customer_name, customer_mobile, sms_sent_at, manual_order_items(id, status, name, sku, unit_shortform, deleted_at)'
    )
    .eq('tenant_id', tenantId)
    .in('id', orderIds)
  return (data ?? []).map((o) => ({
    id: o.id as string,
    order_number: o.order_number as string,
    customer_id: (o.customer_id as string | null) ?? null,
    customer_name: o.customer_name as string,
    customer_mobile: (o.customer_mobile as string | null) ?? null,
    sms_sent_at: (o.sms_sent_at as string | null) ?? null,
    items: (
      (o.manual_order_items ?? []) as {
        id: string
        status: string
        name: string
        sku: string | null
        unit_shortform: string | null
        deleted_at: string | null
      }[]
    )
      .filter((i) => !i.deleted_at && i.status !== 'torolve')
      .map((i) => ({ id: i.id, status: i.status, name: i.name, sku: i.sku, unitShortform: i.unit_shortform || 'db' }))
  }))
}

function smsBody(
  template: string,
  o: OrderForSms,
  counts: MoSmsCounts,
  companyName: string,
  statusUrl: string | null
): string {
  // Link nélkül ne maradjon félbe a „Reszletek:” rész.
  const tpl = statusUrl ? template : template.replace(/\s*(R[eé]szletek:?\s*)?\{status_url\}/gi, '')
  return renderSmsTemplate(tpl, {
    status_url: statusUrl ?? '',
    customer_name: o.customer_name || '',
    order_number: o.order_number || '',
    company_name: companyName,
    ready_count: counts.readyCount,
    total_count: counts.totalCount,
    arrived_count: counts.arrivedCount,
    waiting_count: counts.waitingCount,
    status_text: counts.statusText
  })
}

/** „Megjött” előtt: érintett rendelések SMS-jelöltjei (a kijelölt tételek megjöttnek számítanak). */
export async function getArrivalSmsCandidatesAction(input: {
  itemIds: string[]
}): Promise<{ ok: true; candidates: MoSmsCandidate[] } | { ok: false; message: string }> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!

  const { data: items } = await ctx.supabase
    .from('manual_order_items')
    .select('order_id')
    .eq('tenant_id', tenantId)
    .in('id', input.itemIds)
  const orderIds = [...new Set((items ?? []).map((i) => i.order_id as string))]
  const selected = new Set(input.itemIds)

  const [orders, template, companyName] = await Promise.all([
    loadOrdersForSms(ctx.supabase, tenantId, orderIds),
    getTenantSmsTemplate(ctx.supabase, tenantId, MANUAL_ORDER_READY_TEMPLATE_KEY),
    loadCompanyName(ctx.supabase, tenantId)
  ])

  const candidates = orders.map((o) => {
    const counts = moSmsCounts(o.items, selected)
    const readyCount = counts.readyCount
    return {
      orderId: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      mobile: normalizeE164(o.customer_mobile),
      readyCount,
      totalCount: o.items.length,
      previewBody: smsBody(template, o, counts, companyName, PREVIEW_STATUS_URL),
      alreadySentAt: o.sms_sent_at
    }
  })
  return { ok: true, candidates }
}

const PREVIEW_STATUS_URL = orderStatusAbsoluteUrl('xxxxxxxxxxxx')

async function sendReadySms(
  ctx: Ctx,
  order: OrderForSms,
  template: string,
  companyName: string
): Promise<'sent' | 'failed' | 'skipped'> {
  const tenantId = ctx.user.tenantId!
  const counts = moSmsCounts(order.items)
  const readyCount = counts.readyCount
  const to = normalizeE164(order.customer_mobile)
  const base = {
    tenantId,
    manualOrderId: order.id,
    customerId: order.customer_id,
    templateKey: MANUAL_ORDER_READY_TEMPLATE_KEY,
    createdBy: ctx.user.id
  } as const

  if (!readyCount) return 'skipped'
  if (!to) {
    await insertSmsSendEvent(ctx.supabase, { ...base, status: 'skipped', skipReason: 'bad_phone' })
    return 'skipped'
  }
  const link = template.includes('{status_url}')
    ? await ensureOrderShareLink({
        supabase: ctx.supabase,
        tenantId,
        kind: 'manual',
        refId: order.id,
        userId: ctx.user.id
      }).catch(() => null)
    : null
  const body = smsBody(template, order, counts, companyName, link?.url ?? null)
  if (!body.trim()) {
    await insertSmsSendEvent(ctx.supabase, { ...base, toE164: to, status: 'skipped', skipReason: 'empty_body' })
    return 'skipped'
  }
  const res = await sendPlatformSms({ toE164: to, body })
  if (!res.ok) {
    await insertSmsSendEvent(ctx.supabase, {
      ...base,
      toE164: to,
      bodyLength: res.bodyLength,
      segments: res.segments,
      status: 'failed',
      errorCode: res.error.slice(0, 200)
    })
    await logEvent(ctx, order.id, 'sms', { detail: `Sikertelen: ${res.error.slice(0, 120)}` })
    return 'failed'
  }
  await ctx.supabase
    .from('manual_orders')
    .update({ sms_sent_at: nowIso(), updated_at: nowIso() })
    .eq('id', order.id)
    .eq('tenant_id', tenantId)
  await insertSmsSendEvent(ctx.supabase, {
    ...base,
    toE164: to,
    bodyLength: res.bodyLength,
    segments: res.segments || smsSegments(body),
    providerSid: res.sid,
    status: 'sent'
  })
  await logEvent(ctx, order.id, 'sms', { detail: body })
  return 'sent'
}

async function sendReadySmsMany(ctx: Ctx, orderIds: string[]) {
  const tenantId = ctx.user.tenantId!
  const [orders, template, companyName] = await Promise.all([
    loadOrdersForSms(ctx.supabase, tenantId, orderIds),
    getTenantSmsTemplate(ctx.supabase, tenantId, MANUAL_ORDER_READY_TEMPLATE_KEY),
    loadCompanyName(ctx.supabase, tenantId)
  ])
  let sent = 0
  let failed = 0
  for (const o of orders) {
    const r = await sendReadySms(ctx, o, template, companyName)
    if (r === 'sent') sent++
    if (r === 'failed') failed++
  }
  return { sent, failed }
}

/** Megjött + (opcionális) SMS a kiválasztott rendeléseknek. A státusz SMS-hiba esetén is megmarad. */
export async function markArrivedAction(input: {
  itemIds: string[]
  smsOrderIds: string[]
}): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (input.itemIds.length === 0) return { ok: false, message: 'Nincs kijelölt tétel.' }

  const res = await setStatus(ctx, input.itemIds, 'megerkezett')
  if (!res.ok) return res

  let message = `${res.changed} tétel: Megjött.`
  if (input.smsOrderIds.length > 0) {
    const { sent, failed } = await sendReadySmsMany(ctx, input.smsOrderIds)
    message += ` ${sent} SMS elküldve.`
    if (failed) message += ` ${failed} SMS sikertelen — a rendelésnél újraküldheted.`
  }
  revalidateMo([...res.orderIds, ...input.smsOrderIds])
  return { ok: true, changed: res.changed, message }
}

// ---------------------------------------------------------------------------
// Átadás + fizetés (Scanner minta)
// ---------------------------------------------------------------------------

export type MoHandoverDue = {
  orderId: string
  orderNumber: string
  customerName: string
  /** Most fizetendő: (már átadott + most átadott tételek bruttója) − befizetések; min 0. */
  due: number
  /** Befizetés meghaladja az átvitt értéket (pl. előleg > teljes rendelés). */
  overpaid: number
  unpriced: number
}

/**
 * Rendelésenként: mennyit kell most fizetni, ha a kijelölt tételek átadásra kerülnek.
 * Az előleg/korábbi befizetés először a már elvitt és a most elvitt tételekre számít.
 */
async function computeHandoverDue(ctx: Ctx, itemIds: string[]): Promise<MoHandoverDue[]> {
  const tenantId = ctx.user.tenantId!
  const { data: picked } = await ctx.supabase
    .from('manual_order_items')
    .select('order_id')
    .eq('tenant_id', tenantId)
    .in('id', itemIds)
  const orderIds = [...new Set((picked ?? []).map((r) => r.order_id as string))]
  if (orderIds.length === 0) return []
  const selected = new Set(itemIds)
  const [ordersRes, itemsRes, depRes] = await Promise.all([
    ctx.supabase.from('manual_orders').select('id, order_number, customer_name').eq('tenant_id', tenantId).in('id', orderIds),
    ctx.supabase
      .from('manual_order_items')
      .select('id, order_id, qty, unit_price_gross, status')
      .eq('tenant_id', tenantId)
      .in('order_id', orderIds)
      .is('deleted_at', null),
    ctx.supabase
      .from('manual_order_deposits')
      .select('order_id, amount')
      .eq('tenant_id', tenantId)
      .in('order_id', orderIds)
      .is('voided_at', null)
  ])
  return (ordersRes.data ?? []).map((o) => {
    const items = (itemsRes.data ?? []).filter(
      (i) => i.order_id === o.id && (i.status === 'atadva' || (selected.has(i.id as string) && i.status === 'megerkezett'))
    )
    const taken = items.reduce((s, i) => s + moLineGross(i.unit_price_gross == null ? null : Number(i.unit_price_gross), Number(i.qty)), 0)
    const paid = (depRes.data ?? []).filter((d) => d.order_id === o.id).reduce((s, d) => s + Math.round(Number(d.amount)), 0)
    return {
      orderId: o.id as string,
      orderNumber: o.order_number as string,
      customerName: o.customer_name as string,
      due: Math.max(0, taken - paid),
      overpaid: Math.max(0, paid - taken),
      unpriced: items.filter((i) => i.unit_price_gross == null).length
    }
  })
}

export async function getHandoverDueAction(input: {
  itemIds: string[]
}): Promise<{ ok: true; orders: MoHandoverDue[] } | { ok: false; message: string }> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (input.itemIds.length === 0) return { ok: true, orders: [] }
  return { ok: true, orders: await computeHandoverDue(ctx, input.itemIds) }
}

/** Átadás; `settle` esetén a hátralék rendelésenként „átadáskor” befizetésként rögzül. */
export async function handoverManualItemsAction(input: {
  itemIds: string[]
  settle: boolean
  method?: MoDepositMethod
}): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (input.itemIds.length === 0) return { ok: false, message: 'Nincs kijelölt tétel.' }
  const method = input.method ?? 'keszpenz'
  if (!(['keszpenz', 'kartya', 'atutalas'] as const).includes(method)) {
    return { ok: false, message: 'Érvénytelen fizetési mód.' }
  }

  const { data: ready } = await ctx.supabase
    .from('manual_order_items')
    .select('id')
    .eq('tenant_id', ctx.user.tenantId!)
    .in('id', input.itemIds)
    .eq('status', 'megerkezett')
    .is('deleted_at', null)
  const itemIds = (ready ?? []).map((r) => r.id as string)
  if (itemIds.length === 0) return { ok: false, message: 'Csak megjött tétel adható át.' }

  const dues = input.settle ? (await computeHandoverDue(ctx, itemIds)).filter((d) => d.due > 0) : []
  let paymentIds: string[] = []
  if (dues.length > 0) {
    const { data: ins, error } = await ctx.supabase.from('manual_order_deposits').insert(
      dues.map((d) => ({
        tenant_id: ctx.user.tenantId!,
        order_id: d.orderId,
        amount: d.due,
        method,
        kind: 'atadas',
        note: 'Átadáskor fizetve',
        created_by: ctx.user.id,
        created_by_label: actorLabel(ctx)
      }))
    ).select('id')
    paymentIds = (ins ?? []).map((r) => r.id as string)
    if (error) {
      console.error('handoverManualItems payment', error.message)
      return { ok: false, message: 'Nem sikerült rögzíteni a fizetést — az átadás nem történt meg.' }
    }
    for (const d of dues) {
      await logEvent(ctx, d.orderId, 'deposit', {
        detail: `Átadáskor: ${Math.round(d.due)} Ft (${MO_DEPOSIT_METHOD_LABEL[method]})`
      })
    }
  }

  const res = await setStatus(ctx, itemIds, 'atadva')
  if (!res.ok) {
    if (paymentIds.length > 0) {
      await ctx.supabase
        .from('manual_order_deposits')
        .update({ voided_at: nowIso(), voided_by_label: 'Sikertelen átadás' })
        .in('id', paymentIds)
        .eq('tenant_id', ctx.user.tenantId!)
    }
    return res
  }
  revalidateMo(res.orderIds)
  const sum = dues.reduce((s, d) => s + d.due, 0)
  return {
    ok: true,
    changed: res.changed,
    message:
      sum > 0
        ? `${res.changed} tétel átadva · ${Math.round(sum).toLocaleString('hu-HU')} Ft ${MO_DEPOSIT_METHOD_LABEL[method].toLowerCase()} rögzítve.`
        : `${res.changed} tétel átadva.`
  }
}

export async function resendManualOrderSmsAction(input: { orderId: string }): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const { sent, failed } = await sendReadySmsMany(ctx, [input.orderId])
  revalidateMo([input.orderId])
  if (sent) return { ok: true, message: 'SMS elküldve.' }
  if (failed) return { ok: false, message: 'Az SMS küldése sikertelen.' }
  return { ok: false, message: 'Nincs átvehető tétel vagy érvényes telefonszám.' }
}

// ---------------------------------------------------------------------------
// Előleg
// ---------------------------------------------------------------------------

export async function addManualDepositAction(
  input: { orderId: string } & AddMoDepositInput
): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const parsed = addMoDepositSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Ellenőrizd a kiemelt mezőket.',
      fieldErrors: fieldErrorsFromZod(parsed.error.issues)
    }
  }
  const d = parsed.data
  const { error } = await ctx.supabase.from('manual_order_deposits').insert({
    tenant_id: ctx.user.tenantId!,
    order_id: input.orderId,
    amount: d.amount,
    method: d.method,
    note: d.note ?? null,
    created_by: ctx.user.id,
    created_by_label: actorLabel(ctx)
  })
  if (error) {
    console.error('addManualDeposit', error.message)
    return { ok: false, message: 'Nem sikerült rögzíteni az előleget.' }
  }
  await logEvent(ctx, input.orderId, 'deposit', { detail: `${Math.round(d.amount)} Ft` })
  revalidateMo([input.orderId])
  return { ok: true }
}

export async function voidManualDepositAction(input: {
  orderId: string
  depositId: string
}): Promise<MoActionResult> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const { data, error } = await ctx.supabase
    .from('manual_order_deposits')
    .update({ voided_at: nowIso(), voided_by_label: actorLabel(ctx) })
    .eq('id', input.depositId)
    .eq('order_id', input.orderId)
    .eq('tenant_id', ctx.user.tenantId!)
    .is('voided_at', null)
    .select('amount')
    .maybeSingle()
  if (error || !data) {
    console.error('voidManualDeposit', error?.message)
    return { ok: false, message: 'Nem sikerült sztornózni az előleget.' }
  }
  await logEvent(ctx, input.orderId, 'deposit_void', {
    detail: `${Math.round(Number(data.amount))} Ft`
  })
  revalidateMo([input.orderId])
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Rendelési szöveg + kereső
// ---------------------------------------------------------------------------

export async function getOrderTextAction(input: {
  itemIds: string[]
}): Promise<{ ok: true; blocks: OrderTextBlock[] } | { ok: false; message: string }> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const tenantId = ctx.user.tenantId!
  const [{ data, error }, companyName, companyIntro] = await Promise.all([
    ctx.supabase
      .from('manual_order_items')
      .select('name, sku, qty, unit_shortform, supplier_id, accessory_id')
      .eq('tenant_id', tenantId)
      .in('id', input.itemIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    loadCompanyName(ctx.supabase, tenantId),
    loadCompanyPoIntro(ctx.supabase, tenantId)
  ])
  if (error) {
    console.error('getOrderText', error.message)
    return { ok: false, message: 'Nem sikerült összeállítani a szöveget.' }
  }
  const rows = (data ?? []).map((r) => ({
    supplierId: (r.supplier_id as string | null) ?? null,
    accessoryId: (r.accessory_id as string | null) ?? null,
    name: r.name as string,
    sku: (r.sku as string | null) ?? null,
    qty: Number(r.qty) || 0,
    unitShortform: (r.unit_shortform as string) || 'db'
  }))
  const [info, skus] = await Promise.all([
    loadSupplierInfo(
      ctx.supabase,
      tenantId,
      [...new Set(rows.map((r) => r.supplierId).filter((x): x is string => Boolean(x)))]
    ),
    loadSupplierSkus(ctx.supabase, tenantId, rows)
  ])
  const lines: OrderTextLine[] = rows.map((r) => {
    const s = r.supplierId ? info.get(r.supplierId) : undefined
    const supplierSku = r.supplierId && r.accessoryId ? (skus.get(`${r.supplierId}|${r.accessoryId}`) ?? null) : null
    return {
      supplierId: r.supplierId,
      supplierName: s?.name ?? null,
      name: r.name,
      sku: r.sku,
      supplierSku,
      qty: r.qty,
      unitShortform: r.unitShortform,
      shopUrl: s?.urlTemplate
        ? buildSupplierProductUrl({ urlTemplate: s.urlTemplate, sku: r.sku, supplierSku, name: r.name })
        : null
    }
  })
  const meta = new Map<string, OrderTextSupplier>(
    [...info.values()].map((s) => [s.id, { email: s.email, phone: s.phone, intro: s.intro, preferred: s.preferred }])
  )
  return { ok: true, blocks: buildOrderTextBlocks(lines, companyName, meta, new Date(), companyIntro) }
}

/** Vevői státuszoldal link (másoláshoz, pl. Viberre) — létrehozza, ha még nincs. */
export async function getManualOrderStatusLinkAction(input: {
  orderId: string
}): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  const link = await ensureOrderShareLink({
    supabase: ctx.supabase,
    tenantId: ctx.user.tenantId!,
    kind: 'manual',
    refId: input.orderId,
    userId: ctx.user.id
  })
  if (!link) {
    return { ok: false, message: 'Nem sikerült linket készíteni. Futtasd a 20261025 migrációt.' }
  }
  revalidatePath(`${LIST_PATH}/${input.orderId}`)
  return { ok: true, url: link.url }
}

export async function searchManualOrdersAction(
  q: string
): Promise<{ ok: true; hits: MoSearchHit[] } | { ok: false; message: string }> {
  const ctx = await requireMoContext()
  if (!ctx.ok) return { ok: false, message: ctx.message }
  if (!ctx.user.allowedPages.includes(LIST_PATH)) return { ok: true, hits: [] }
  const hits = await searchManualOrders(ctx.supabase, ctx.user.tenantId!, q)
  return { ok: true, hits }
}
