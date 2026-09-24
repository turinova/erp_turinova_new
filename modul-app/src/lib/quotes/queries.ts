import type { SupabaseClient } from '@supabase/supabase-js'

import type { PricingMode } from '@/lib/opti/quote-calculations'
import { listQuoteFees, type QuoteFeeRow } from '@/lib/quotes/fee-totals'
import {
  listQuoteAccessories,
  type QuoteAccessoryRow
} from '@/lib/quotes/accessory-totals'
import type { PaymentStatus } from '@/lib/quotes/payment-labels'

export type QuoteStatus =
  | 'draft'
  | 'ordered'
  | 'in_production'
  | 'ready'
  | 'finished'
  | 'cancelled'

/** Opti visszatöltés / mentés — csak ezek a státuszok. */
export function isQuoteEditableInOpti(status: QuoteStatus): boolean {
  return status === 'draft' || status === 'ordered'
}

export type QuotePaymentRow = {
  id: string
  amount: number
  payment_method_name: string
  comment: string | null
  payment_date: string
}

export type QuoteListItem = {
  id: string
  quote_number: string
  order_number: string | null
  status: QuoteStatus
  payment_status: PaymentStatus
  source: string
  portal_submitted_at: string | null
  project_name: string | null
  total_gross: number
  currency: string
  updated_at: string
  customer_name: string
  customer_email: string | null
  customer_mobile: string | null
  panel_quantity: number
}

export type QuoteDetail = {
  id: string
  quote_number: string
  order_number: string | null
  status: QuoteStatus
  payment_status: PaymentStatus
  source: string
  portal_submitted_at: string | null
  pricing_mode: PricingMode
  currency: string
  total_net: number
  total_vat: number
  total_gross: number
  fees_total_net: number
  fees_total_vat: number
  fees_total_gross: number
  accessories_total_net: number
  accessories_total_vat: number
  accessories_total_gross: number
  final_total_gross: number
  comment: string | null
  project_name: string | null
  created_at: string
  updated_at: string
  panel_quantity: number
  total_paid: number
  payments: QuotePaymentRow[]
  fees: QuoteFeeRow[]
  accessories: QuoteAccessoryRow[]
  production_machine_id: string | null
  production_date: string | null
  barcode: string | null
  production_machine_name: string | null
  customer: {
    id: string
    name: string
    email: string | null
    mobile: string | null
    billing_name: string | null
    billing_country: string
    billing_city: string | null
    billing_postal_code: string | null
    billing_street: string | null
    billing_house_number: string | null
    billing_tax_number: string | null
    billing_company_reg_number: string | null
  }
  panels: Array<{
    id: string
    sheet_material_id: string
    material_name: string
    material_machine_code: string | null
    grain_mm: number
    cross_mm: number
    quantity: number
    label: string | null
    edge_a_code: string | null
    edge_b_code: string | null
    edge_c_code: string | null
    edge_d_code: string | null
  }>
  material_lines: Array<{
    id: string
    material_name: string
    pricing_method: string
    boards_charged: number
    charged_sqm: number
    waste_multi: number
    board_grain_mm: number
    board_cross_mm: number
    material_net: number
    material_gross: number
    edge_length_m: number
    edge_net: number
    edge_gross: number
    cutting_length_m: number
    cutting_net: number
    cutting_gross: number
    total_gross: number
    edges: Array<{
      edge_name: string
      length_m: number
      gross_price: number
    }>
  }>
  edge_summary: Array<{
    material_name: string
    edge_name: string
    length_m: number
  }>
}

export type QuoteListParams = {
  tenantId: string
  status?: QuoteStatus | 'all'
  q?: string
  page?: number
  limit?: number
}

export type QuoteListResult = {
  rows: QuoteListItem[]
  total: number
  page: number
  limit: number
}

export async function listQuotes(
  supabase: SupabaseClient,
  params: QuoteListParams
): Promise<QuoteListResult> {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(50, Math.max(1, params.limit ?? 25))
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('quotes')
    .select(
      `
      id,
      quote_number,
      order_number,
      status,
      payment_status,
      source,
      portal_submitted_at,
      project_name,
      total_gross,
      final_total_gross,
      currency,
      updated_at,
      customers ( name, email, mobile ),
      quote_panels ( quantity )
    `,
      { count: 'estimated' }
    )
    .eq('tenant_id', params.tenantId)
    .is('deleted_at', null)
    // Partner portal: unsubmitted drafts stay hidden from staff until submit
    .or('source.neq.portal,portal_submitted_at.not.is.null')

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  } else {
    query = query.eq('status', 'draft')
  }

  const q = params.q?.trim()
  if (q) {
    const safe = q.replace(/[%_,]/g, '')
    if (safe) {
      const { data: customerMatches } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', params.tenantId)
        .is('deleted_at', null)
        .ilike('name', `%${safe}%`)
        .limit(100)

      const customerIds = (customerMatches ?? []).map((c) => c.id)
      if (customerIds.length > 0) {
        query = query.or(
          `quote_number.ilike.%${safe}%,project_name.ilike.%${safe}%,customer_id.in.(${customerIds.join(',')})`
        )
      } else {
        query = query.or(
          `quote_number.ilike.%${safe}%,project_name.ilike.%${safe}%`
        )
      }
    }
  }

  const { data, error, count } = await query
    .order('updated_at', { ascending: false })
    .range(from, to)

  if (error) {
    console.error('listQuotes', error.message)
    throw new Error('Nem sikerült betölteni az árajánlatokat.')
  }

  const rows: QuoteListItem[] = (data ?? []).map((row) => {
    const customers = row.customers as
      | { name: string; email: string | null; mobile: string | null }
      | { name: string; email: string | null; mobile: string | null }[]
      | null
    const customer = Array.isArray(customers) ? customers[0] : customers
    const panels = (row.quote_panels ?? []) as Array<{ quantity: number }>
    const panelQuantity = panels.reduce(
      (sum, p) => sum + (Number(p.quantity) || 0),
      0
    )
    return {
      id: row.id,
      quote_number: row.quote_number,
      order_number: row.order_number,
      status: row.status as QuoteStatus,
      payment_status: (row.payment_status ?? 'not_paid') as PaymentStatus,
      source: row.source ?? 'opti',
      portal_submitted_at: row.portal_submitted_at ?? null,
      project_name: (row.project_name as string | null) ?? null,
      total_gross: Number(row.final_total_gross ?? row.total_gross),
      currency: row.currency,
      updated_at: row.updated_at,
      customer_name: customer?.name ?? '—',
      customer_email: customer?.email ?? null,
      customer_mobile: customer?.mobile ?? null,
      panel_quantity: panelQuantity
    }
  })

  return { rows, total: count ?? 0, page, limit }
}

export async function getQuoteDetail(
  supabase: SupabaseClient,
  tenantId: string,
  id: string,
  options?: {
    /** Partner: elküldetlen portal draft is betölthető */
    allowUnsubmittedPortal?: boolean
    /** Partner: nincs quote_payments RLS */
    skipPayments?: boolean
  }
): Promise<QuoteDetail | null> {
  // Dynamic select breaks Supabase codegen inference — cast result.
  const selectCols = options?.skipPayments
    ? `
      id,
      quote_number,
      order_number,
      status,
      payment_status,
      source,
      pricing_mode,
      currency,
      total_net,
      total_vat,
      total_gross,
      fees_total_net,
      fees_total_vat,
      fees_total_gross,
      accessories_total_net,
      accessories_total_vat,
      accessories_total_gross,
      final_total_gross,
      comment,
      project_name,
      created_at,
      updated_at,
      production_machine_id,
      production_date,
      barcode,
      portal_submitted_at,
      billing_name_snapshot,
      billing_country_snapshot,
      billing_city_snapshot,
      billing_postal_code_snapshot,
      billing_street_snapshot,
      billing_house_number_snapshot,
      billing_tax_number_snapshot,
      customers (
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
        billing_tax_number,
        billing_company_reg_number
      ),
      quote_panels (
        id,
        sheet_material_id,
        grain_mm,
        cross_mm,
        quantity,
        label,
        sort_index,
        sheet_materials ( name, machine_code ),
        edge_a:edge_materials!quote_panels_edge_a_id_fkey ( machine_code ),
        edge_b:edge_materials!quote_panels_edge_b_id_fkey ( machine_code ),
        edge_c:edge_materials!quote_panels_edge_c_id_fkey ( machine_code ),
        edge_d:edge_materials!quote_panels_edge_d_id_fkey ( machine_code )
      ),
      quote_material_lines (
        id,
        material_name,
        pricing_method,
        boards_charged,
        charged_sqm,
        waste_multi,
        board_grain_mm,
        board_cross_mm,
        material_net,
        material_gross,
        edge_length_m,
        edge_net,
        edge_gross,
        cutting_length_m,
        cutting_net,
        cutting_gross,
        total_gross,
        quote_edge_lines (
          edge_name,
          length_m,
          gross_price
        )
      )
    `
    : `
      id,
      quote_number,
      order_number,
      status,
      payment_status,
      source,
      pricing_mode,
      currency,
      total_net,
      total_vat,
      total_gross,
      fees_total_net,
      fees_total_vat,
      fees_total_gross,
      accessories_total_net,
      accessories_total_vat,
      accessories_total_gross,
      final_total_gross,
      comment,
      project_name,
      created_at,
      updated_at,
      production_machine_id,
      production_date,
      barcode,
      portal_submitted_at,
      billing_name_snapshot,
      billing_country_snapshot,
      billing_city_snapshot,
      billing_postal_code_snapshot,
      billing_street_snapshot,
      billing_house_number_snapshot,
      billing_tax_number_snapshot,
      production_machines ( name ),
      customers (
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
        billing_tax_number,
        billing_company_reg_number
      ),
      quote_panels (
        id,
        sheet_material_id,
        grain_mm,
        cross_mm,
        quantity,
        label,
        sort_index,
        sheet_materials ( name, machine_code ),
        edge_a:edge_materials!quote_panels_edge_a_id_fkey ( machine_code ),
        edge_b:edge_materials!quote_panels_edge_b_id_fkey ( machine_code ),
        edge_c:edge_materials!quote_panels_edge_c_id_fkey ( machine_code ),
        edge_d:edge_materials!quote_panels_edge_d_id_fkey ( machine_code )
      ),
      quote_material_lines (
        id,
        material_name,
        pricing_method,
        boards_charged,
        charged_sqm,
        waste_multi,
        board_grain_mm,
        board_cross_mm,
        material_net,
        material_gross,
        edge_length_m,
        edge_net,
        edge_gross,
        cutting_length_m,
        cutting_net,
        cutting_gross,
        total_gross,
        quote_edge_lines (
          edge_name,
          length_m,
          gross_price
        )
      )
    `

  const quoteQuery = supabase
    .from('quotes')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select(selectCols as any)
    .eq('tenant_id', tenantId)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  const paymentsQuery = options?.skipPayments
    ? Promise.resolve({ data: null as null, error: null })
    : supabase
        .from('quote_payments')
        .select('id, amount, payment_method_name, comment, payment_date')
        .eq('quote_id', id)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('payment_date', { ascending: true })

  const feesQuery = listQuoteFees(supabase, tenantId, id).catch((err) => {
    console.error('getQuoteDetail fees', err)
    throw err
  })

  const accessoriesQuery = listQuoteAccessories(supabase, tenantId, id).catch(
    (err) => {
      console.error('getQuoteDetail accessories', err)
      throw err
    }
  )

  const [{ data: rawData, error }, paymentsResult, fees, accessories] =
    await Promise.all([
      quoteQuery,
      paymentsQuery,
      feesQuery,
      accessoriesQuery
    ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = rawData as any

  if (error) {
    console.error('getQuoteDetail', error.message)
    throw new Error('Nem sikerült betölteni az árajánlatot.')
  }
  if (!data) return null

  // Unsubmitted partner portal drafts are invisible to staff until submit
  if (
    !options?.allowUnsubmittedPortal &&
    data.source === 'portal' &&
    data.portal_submitted_at == null
  ) {
    return null
  }

  let payments: QuotePaymentRow[] = []
  let total_paid = 0

  if (!options?.skipPayments) {
    if (paymentsResult.error) {
      console.error('getQuoteDetail payments', paymentsResult.error.message)
      throw new Error('Nem sikerült betölteni a befizetéseket.')
    }

    payments = (paymentsResult.data ?? []).map(
      (p: {
        id: string
        amount: number | string
        payment_method_name: string
        comment: string | null
        payment_date: string
      }) => ({
        id: p.id,
        amount: Number(p.amount),
        payment_method_name: p.payment_method_name,
        comment: p.comment,
        payment_date: p.payment_date
      })
    )
    total_paid = payments.reduce((sum, p) => sum + p.amount, 0)
  }

  const customers = data.customers as
    | {
        id: string
        name: string
        email: string | null
        mobile: string | null
        billing_name: string | null
        billing_country: string
        billing_city: string | null
        billing_postal_code: string | null
        billing_street: string | null
        billing_house_number: string | null
        billing_tax_number: string | null
        billing_company_reg_number: string | null
      }
    | {
        id: string
        name: string
        email: string | null
        mobile: string | null
        billing_name: string | null
        billing_country: string
        billing_city: string | null
        billing_postal_code: string | null
        billing_street: string | null
        billing_house_number: string | null
        billing_tax_number: string | null
        billing_company_reg_number: string | null
      }[]
    | null
  const customer = Array.isArray(customers) ? customers[0] : customers
  if (!customer) return null

  type EdgeRef = { machine_code: string } | { machine_code: string }[] | null

  function edgeCode(ref: EdgeRef): string | null {
    const row = Array.isArray(ref) ? ref[0] : ref
    const code = row?.machine_code?.trim()
    return code || null
  }

  const panelsRaw = (data.quote_panels ?? []) as Array<{
    id: string
    sheet_material_id: string
    grain_mm: number
    cross_mm: number
    quantity: number
    label: string | null
    sort_index: number
    sheet_materials:
      | { name: string; machine_code: string }
      | { name: string; machine_code: string }[]
      | null
    edge_a: EdgeRef
    edge_b: EdgeRef
    edge_c: EdgeRef
    edge_d: EdgeRef
  }>

  const panels = [...panelsRaw]
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((p) => {
      const sm = Array.isArray(p.sheet_materials)
        ? p.sheet_materials[0]
        : p.sheet_materials
      return {
        id: p.id,
        sheet_material_id: p.sheet_material_id,
        material_name: sm?.name ?? '—',
        material_machine_code: sm?.machine_code?.trim() || null,
        grain_mm: p.grain_mm,
        cross_mm: p.cross_mm,
        quantity: p.quantity,
        label: p.label,
        edge_a_code: edgeCode(p.edge_a),
        edge_b_code: edgeCode(p.edge_b),
        edge_c_code: edgeCode(p.edge_c),
        edge_d_code: edgeCode(p.edge_d)
      }
    })

  const panelQuantity = panels.reduce((sum, p) => sum + p.quantity, 0)

  const linesRaw = (data.quote_material_lines ?? []) as Array<{
    id: string
    material_name: string
    pricing_method: string
    boards_charged: number
    charged_sqm: number
    waste_multi: number
    board_grain_mm: number
    board_cross_mm: number
    material_net: number
    material_gross: number
    edge_length_m: number
    edge_net: number
    edge_gross: number
    cutting_length_m: number
    cutting_net: number
    cutting_gross: number
    total_gross: number
    quote_edge_lines: Array<{
      edge_name: string
      length_m: number
      gross_price: number
    }> | null
  }>

  const material_lines = linesRaw.map((line) => ({
    id: line.id,
    material_name: line.material_name,
    pricing_method: line.pricing_method,
    boards_charged: line.boards_charged,
    charged_sqm: Number(line.charged_sqm),
    waste_multi: Number(line.waste_multi) || 1,
    board_grain_mm: line.board_grain_mm,
    board_cross_mm: line.board_cross_mm,
    material_net: Number(line.material_net),
    material_gross: Number(line.material_gross),
    edge_length_m: Number(line.edge_length_m),
    edge_net: Number(line.edge_net),
    edge_gross: Number(line.edge_gross),
    cutting_length_m: Number(line.cutting_length_m),
    cutting_net: Number(line.cutting_net),
    cutting_gross: Number(line.cutting_gross),
    total_gross: Number(line.total_gross),
    edges: (line.quote_edge_lines ?? []).map((e) => ({
      edge_name: e.edge_name,
      length_m: Number(e.length_m),
      gross_price: Number(e.gross_price)
    }))
  }))

  const edge_summary = material_lines.flatMap((line) =>
    line.edges.map((e) => ({
      material_name: line.material_name,
      edge_name: e.edge_name,
      length_m: e.length_m
    }))
  )

  return {
    id: data.id,
    quote_number: data.quote_number,
    order_number: data.order_number,
    status: data.status as QuoteStatus,
    payment_status: (data.payment_status ?? 'not_paid') as PaymentStatus,
    source: data.source,
    portal_submitted_at: data.portal_submitted_at ?? null,
    pricing_mode: data.pricing_mode as PricingMode,
    currency: data.currency,
    total_net: Number(data.total_net),
    total_vat: Number(data.total_vat),
    total_gross: Number(data.total_gross),
    fees_total_net: Number(data.fees_total_net ?? 0),
    fees_total_vat: Number(data.fees_total_vat ?? 0),
    fees_total_gross: Number(data.fees_total_gross ?? 0),
    accessories_total_net: Number(data.accessories_total_net ?? 0),
    accessories_total_vat: Number(data.accessories_total_vat ?? 0),
    accessories_total_gross: Number(data.accessories_total_gross ?? 0),
    final_total_gross: Number(
      data.final_total_gross ?? data.total_gross ?? 0
    ),
    comment: data.comment,
    project_name: (data.project_name as string | null) ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
    panel_quantity: panelQuantity,
    total_paid,
    payments,
    fees,
    accessories,
    production_machine_id: data.production_machine_id ?? null,
    production_date: data.production_date ?? null,
    barcode: data.barcode ?? null,
    production_machine_name: (() => {
      const m = data.production_machines as
        | { name: string }
        | { name: string }[]
        | null
        | undefined
      const one = Array.isArray(m) ? m[0] : m
      return one?.name ?? null
    })(),
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      mobile: customer.mobile,
      billing_name:
        (data.billing_name_snapshot as string | null) ??
        customer.billing_name,
      billing_country:
        (data.billing_country_snapshot as string | null) ||
        customer.billing_country ||
        'Magyarország',
      billing_city:
        (data.billing_city_snapshot as string | null) ??
        customer.billing_city,
      billing_postal_code:
        (data.billing_postal_code_snapshot as string | null) ??
        customer.billing_postal_code,
      billing_street:
        (data.billing_street_snapshot as string | null) ??
        customer.billing_street,
      billing_house_number:
        (data.billing_house_number_snapshot as string | null) ??
        customer.billing_house_number,
      billing_tax_number:
        (data.billing_tax_number_snapshot as string | null) ??
        customer.billing_tax_number,
      billing_company_reg_number: customer.billing_company_reg_number
    },
    panels,
    material_lines,
    edge_summary
  }
}
