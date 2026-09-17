import type { SupabaseClient } from '@supabase/supabase-js'

import type {
  SaleChannel,
  SalePaymentStatus,
  SaleStatus
} from '@/lib/sales/parse'

export type SaleListItem = {
  id: string
  sale_number: string
  channel: SaleChannel
  status: SaleStatus
  payment_status: SalePaymentStatus
  customer_name: string | null
  warehouse_name: string
  total_gross: number
  items_count: number
  fulfilled_at: string | null
  created_at: string
}

export type SaleItemRow = {
  id: string
  item_kind: 'product' | 'fee'
  accessory_id: string | null
  name_snapshot: string
  sku_snapshot: string | null
  unit_shortform: string
  quantity: number
  unit_price_gross: number
  discount_percentage: number
  discount_amount: number
  total_gross: number
  tax_rate_percent: number
}

export type SalePaymentRow = {
  id: string
  payment_method_name: string
  amount: number
  paid_at: string
  status: string
}

export type SaleDetail = {
  id: string
  sale_number: string
  channel: SaleChannel
  status: SaleStatus
  payment_status: SalePaymentStatus
  warehouse_id: string
  warehouse_name: string
  customer_id: string | null
  customer_name: string | null
  discount_percentage: number
  discount_amount: number
  subtotal_net: number
  total_vat: number
  total_gross: number
  cash_rounding_amount: number
  note: string | null
  fulfilled_at: string | null
  created_at: string
  items: SaleItemRow[]
  payments: SalePaymentRow[]
}

export type SaleListParams = {
  tenantId: string
  q?: string
  status?: SaleStatus | 'all'
  paymentStatus?: SalePaymentStatus | 'all'
  page?: number
  limit?: number
}

export type SaleListResult = {
  rows: SaleListItem[]
  total: number
  page: number
  limit: number
}

export async function listSales(
  supabase: SupabaseClient,
  params: SaleListParams
): Promise<SaleListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const q = params.q?.trim() ?? ''

  let query = supabase
    .from('sales_orders')
    .select(
      `
      id,
      sale_number,
      channel,
      status,
      payment_status,
      customer_name_snapshot,
      total_gross,
      fulfilled_at,
      created_at,
      warehouses ( name ),
      sales_order_items ( id, deleted_at )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    query = query.or(
      `sale_number.ilike.%${q}%,customer_name_snapshot.ilike.%${q}%`
    )
  }
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }
  if (params.paymentStatus && params.paymentStatus !== 'all') {
    query = query.eq('payment_status', params.paymentStatus)
  }

  const { data, error, count } = await query
  if (error) {
    console.error('listSales', error.message)
    throw new Error('Nem sikerült betölteni az értékesítéseket.')
  }

  const rows: SaleListItem[] = (data ?? []).map((row) => {
    const wh = row.warehouses as
      | { name: string }
      | { name: string }[]
      | null
    const whOne = Array.isArray(wh) ? wh[0] : wh
    const items = (row.sales_order_items ?? []) as {
      id: string
      deleted_at: string | null
    }[]
    return {
      id: row.id,
      sale_number: row.sale_number,
      channel: row.channel as SaleChannel,
      status: row.status as SaleStatus,
      payment_status: row.payment_status as SalePaymentStatus,
      customer_name: row.customer_name_snapshot,
      warehouse_name: whOne?.name ?? '—',
      total_gross: Number(row.total_gross),
      items_count: items.filter((i) => !i.deleted_at).length,
      fulfilled_at: row.fulfilled_at,
      created_at: row.created_at
    }
  })

  return { rows, total: count ?? rows.length, page, limit }
}

export async function getSale(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<SaleDetail | null> {
  const { data, error } = await supabase
    .from('sales_orders')
    .select(
      `
      id,
      sale_number,
      channel,
      status,
      payment_status,
      warehouse_id,
      customer_id,
      customer_name_snapshot,
      discount_percentage,
      discount_amount,
      subtotal_net,
      total_vat,
      total_gross,
      cash_rounding_amount,
      note,
      fulfilled_at,
      created_at,
      warehouses ( name ),
      sales_order_items (
        id,
        item_kind,
        accessory_id,
        name_snapshot,
        sku_snapshot,
        unit_shortform,
        quantity,
        unit_price_gross,
        discount_percentage,
        discount_amount,
        total_gross,
        tax_rate_percent,
        sort_order,
        deleted_at
      ),
      sales_payments (
        id,
        payment_method_name,
        amount,
        paid_at,
        status,
        deleted_at
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getSale', error.message)
    throw new Error('Nem sikerült betölteni az értékesítést.')
  }
  if (!data) return null

  const wh = data.warehouses as
    | { name: string }
    | { name: string }[]
    | null
  const whOne = Array.isArray(wh) ? wh[0] : wh

  const items = (
    (data.sales_order_items ?? []) as {
      id: string
      item_kind: 'product' | 'fee'
      accessory_id: string | null
      name_snapshot: string
      sku_snapshot: string | null
      unit_shortform: string
      quantity: number
      unit_price_gross: number
      discount_percentage: number
      discount_amount: number
      total_gross: number
      tax_rate_percent: number
      sort_order: number
      deleted_at: string | null
    }[]
  )
    .filter((i) => !i.deleted_at)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({
      id: i.id,
      item_kind: i.item_kind,
      accessory_id: i.accessory_id,
      name_snapshot: i.name_snapshot,
      sku_snapshot: i.sku_snapshot,
      unit_shortform: i.unit_shortform,
      quantity: Number(i.quantity),
      unit_price_gross: Number(i.unit_price_gross),
      discount_percentage: Number(i.discount_percentage),
      discount_amount: Number(i.discount_amount),
      total_gross: Number(i.total_gross),
      tax_rate_percent: Number(i.tax_rate_percent)
    }))

  const payments = (
    (data.sales_payments ?? []) as {
      id: string
      payment_method_name: string
      amount: number
      paid_at: string
      status: string
      deleted_at: string | null
    }[]
  )
    .filter((p) => !p.deleted_at)
    .map((p) => ({
      id: p.id,
      payment_method_name: p.payment_method_name,
      amount: Number(p.amount),
      paid_at: p.paid_at,
      status: p.status
    }))

  return {
    id: data.id,
    sale_number: data.sale_number,
    channel: data.channel as SaleChannel,
    status: data.status as SaleStatus,
    payment_status: data.payment_status as SalePaymentStatus,
    warehouse_id: data.warehouse_id,
    warehouse_name: whOne?.name ?? '—',
    customer_id: data.customer_id,
    customer_name: data.customer_name_snapshot,
    discount_percentage: Number(data.discount_percentage),
    discount_amount: Number(data.discount_amount),
    subtotal_net: Number(data.subtotal_net),
    total_vat: Number(data.total_vat),
    total_gross: Number(data.total_gross),
    cash_rounding_amount: Number(data.cash_rounding_amount),
    note: data.note,
    fulfilled_at: data.fulfilled_at,
    created_at: data.created_at,
    items,
    payments
  }
}

export type SaleProductSearchItem = {
  id: string
  name: string
  sku: string
  price_net: number
  tax_rate_percent: number
  unit_shortform: string
  on_hand: number
}

/** Eladható termékek keresése + aktuális raktár készlet. */
export async function searchProductsForSale(
  supabase: SupabaseClient,
  tenantId: string,
  q: string,
  warehouseId: string,
  opts?: { inStockOnly?: boolean; limit?: number }
): Promise<SaleProductSearchItem[]> {
  const safe = q.trim().replace(/[%_,]/g, '')
  if (!safe || !warehouseId) return []

  const limit = opts?.limit ?? 15
  const { data, error } = await supabase
    .from('accessories')
    .select(
      `
      id,
      name,
      sku,
      price_net,
      tax_rate_id,
      unit_id,
      tax_rates ( rate_percent ),
      units ( shortform )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .is('deleted_at', null)
    .or(
      `name.ilike.%${safe}%,sku.ilike.%${safe}%,barcode.ilike.%${safe}%,barcode_internal.ilike.%${safe}%`
    )
    .order('name', { ascending: true })
    .limit(opts?.inStockOnly ? Math.max(limit * 3, 30) : limit)

  if (error) {
    console.error('searchProductsForSale', error.message)
    throw new Error('Nem sikerült keresni a termékek között.')
  }

  const rows = data ?? []
  if (rows.length === 0) return []

  const { getAccessoriesOnHandMap } = await import('@/lib/stock/queries')
  const onHandMap = await getAccessoriesOnHandMap(
    supabase,
    tenantId,
    rows.map((r) => r.id as string),
    warehouseId
  )

  const mapped: SaleProductSearchItem[] = rows.map((row) => {
    const taxRates = row.tax_rates as
      | { rate_percent: number | string }
      | { rate_percent: number | string }[]
      | null
    const tax = Array.isArray(taxRates) ? taxRates[0] : taxRates
    const units = row.units as
      | { shortform: string }
      | { shortform: string }[]
      | null
    const unit = Array.isArray(units) ? units[0] : units
    return {
      id: row.id as string,
      name: row.name as string,
      sku: row.sku as string,
      price_net: Number(row.price_net) || 0,
      tax_rate_percent: Number(tax?.rate_percent ?? 0),
      unit_shortform: unit?.shortform ?? 'db',
      on_hand: onHandMap.get(row.id as string) ?? 0
    }
  })

  const filtered = opts?.inStockOnly
    ? mapped.filter((r) => r.on_hand > 0)
    : mapped

  return filtered.slice(0, limit)
}
