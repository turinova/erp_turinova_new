import type { SupabaseClient } from '@supabase/supabase-js'

import type { SalesQuoteStatus } from '@/lib/sales-quotes/parse'

export type SalesQuoteListItem = {
  id: string
  quote_number: string
  status: SalesQuoteStatus
  customer_name: string | null
  warehouse_name: string
  total_gross: number
  valid_until: string | null
  created_at: string
  converted_sale_id: string | null
}

export type SalesQuoteItemRow = {
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

export type SalesQuoteDetail = {
  id: string
  quote_number: string
  status: SalesQuoteStatus
  warehouse_id: string
  warehouse_name: string
  customer_id: string
  customer_name: string | null
  customer_email: string | null
  customer_mobile: string | null
  billing_name: string | null
  billing_country: string | null
  billing_city: string | null
  billing_postal_code: string | null
  billing_street: string | null
  billing_house_number: string | null
  billing_tax_number: string | null
  discount_percentage: number
  discount_amount: number
  subtotal_net: number
  total_vat: number
  total_gross: number
  valid_until: string | null
  note: string | null
  lost_reason: string | null
  converted_sale_id: string | null
  cloned_from_id: string | null
  created_at: string
  created_by_label: string | null
  items: SalesQuoteItemRow[]
}

export async function listSalesQuotes(
  supabase: SupabaseClient,
  params: {
    tenantId: string
    q?: string
    status?: SalesQuoteStatus | 'all'
    page?: number
    limit?: number
  }
): Promise<{
  rows: SalesQuoteListItem[]
  total: number
  page: number
  limit: number
}> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1
  const q = params.q?.trim() ?? ''

  let query = supabase
    .from('sales_quotes')
    .select(
      `
      id, quote_number, status, customer_name_snapshot,
      total_gross, valid_until, created_at, converted_sale_id,
      warehouses ( name )
    `,
      { count: 'exact' }
    )
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (q) {
    query = query.or(
      `quote_number.ilike.%${q}%,customer_name_snapshot.ilike.%${q}%`
    )
  }
  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }

  const { data, error, count } = await query
  if (error) {
    console.error('listSalesQuotes', error.message)
    throw new Error('Nem sikerült betölteni az árajánlatokat.')
  }

  const rows: SalesQuoteListItem[] = (data ?? []).map((row) => {
    const wh = row.warehouses as { name: string } | { name: string }[] | null
    const whOne = Array.isArray(wh) ? wh[0] : wh
    return {
      id: row.id,
      quote_number: row.quote_number,
      status: row.status as SalesQuoteStatus,
      customer_name: row.customer_name_snapshot,
      warehouse_name: whOne?.name ?? '—',
      total_gross: Number(row.total_gross),
      valid_until: row.valid_until,
      created_at: row.created_at,
      converted_sale_id: row.converted_sale_id
    }
  })

  return { rows, total: count ?? rows.length, page, limit }
}

export async function getSalesQuote(
  supabase: SupabaseClient,
  tenantId: string,
  id: string
): Promise<SalesQuoteDetail | null> {
  const { data, error } = await supabase
    .from('sales_quotes')
    .select(
      `
      id, quote_number, status, warehouse_id, customer_id,
      customer_name_snapshot, customer_email_snapshot, customer_mobile_snapshot,
      billing_name_snapshot, billing_country_snapshot, billing_city_snapshot,
      billing_postal_code_snapshot, billing_street_snapshot,
      billing_house_number_snapshot, billing_tax_number_snapshot,
      discount_percentage, discount_amount, subtotal_net, total_vat, total_gross,
      valid_until, note, lost_reason, converted_sale_id, cloned_from_id, created_at,
      created_by_label_snapshot,
      warehouses ( name ),
      sales_quote_items (
        id, item_kind, accessory_id, name_snapshot, sku_snapshot,
        unit_shortform, quantity, unit_price_gross, discount_percentage,
        discount_amount, total_gross, tax_rate_percent, sort_order, deleted_at
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getSalesQuote', error.message)
    throw new Error('Nem sikerült betölteni az árajánlatot.')
  }
  if (!data) return null

  const wh = data.warehouses as { name: string } | { name: string }[] | null
  const whOne = Array.isArray(wh) ? wh[0] : wh
  const items = (
    (data.sales_quote_items ?? []) as {
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
      discount_amount: Number(i.discount_amount ?? 0),
      total_gross: Number(i.total_gross),
      tax_rate_percent: Number(i.tax_rate_percent)
    }))

  return {
    id: data.id,
    quote_number: data.quote_number,
    status: data.status as SalesQuoteStatus,
    warehouse_id: data.warehouse_id,
    warehouse_name: whOne?.name ?? '—',
    customer_id: data.customer_id,
    customer_name: data.customer_name_snapshot,
    customer_email: data.customer_email_snapshot,
    customer_mobile: data.customer_mobile_snapshot,
    billing_name: data.billing_name_snapshot ?? null,
    billing_country: data.billing_country_snapshot ?? null,
    billing_city: data.billing_city_snapshot ?? null,
    billing_postal_code: data.billing_postal_code_snapshot ?? null,
    billing_street: data.billing_street_snapshot ?? null,
    billing_house_number: data.billing_house_number_snapshot ?? null,
    billing_tax_number: data.billing_tax_number_snapshot ?? null,
    discount_percentage: Number(data.discount_percentage),
    discount_amount: Number(data.discount_amount),
    subtotal_net: Number(data.subtotal_net),
    total_vat: Number(data.total_vat),
    total_gross: Number(data.total_gross),
    valid_until: data.valid_until,
    note: data.note,
    lost_reason: data.lost_reason,
    converted_sale_id: data.converted_sale_id,
    cloned_from_id: data.cloned_from_id ?? null,
    created_at: data.created_at,
    created_by_label: data.created_by_label_snapshot,
    items
  }
}
