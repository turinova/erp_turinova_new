import type { SupabaseClient } from '@supabase/supabase-js'

import type { TenantCompanyRow } from '@/lib/company/queries'
import type {
  QuotePdfInput,
  TenantCompanyPdf
} from '@/lib/quotes/pdf-template'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export function tenantCompanyToPdf(
  company: TenantCompanyRow
): TenantCompanyPdf {
  return {
    id: company.tenant_id,
    name: company.name,
    country: company.country,
    city: company.city,
    postal_code: company.postal_code,
    address: company.address,
    tax_number: company.tax_number,
    vat_id: company.vat_id,
    quote_validity_days: company.quote_validity_days ?? 14
  }
}

/** Lean quote payload shaped for the main-app PDF template. */
export async function getQuoteForPdf(
  supabase: SupabaseClient,
  tenantId: string,
  quoteId: string
): Promise<QuotePdfInput | null> {
  const { data, error } = await supabase
    .from('quotes')
    .select(
      `
      id,
      quote_number,
      barcode,
      comment,
      created_at,
      total_net,
      total_vat,
      total_gross,
      customers (
        name,
        email,
        mobile,
        billing_name,
        billing_country,
        billing_city,
        billing_postal_code,
        billing_street,
        billing_house_number,
        billing_tax_number
      ),
      quote_panels (
        id,
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
        board_grain_mm,
        board_cross_mm,
        thickness_mm,
        charged_sqm,
        waste_multi,
        boards_charged,
        material_net,
        material_gross,
        cutting_length_m,
        cutting_net,
        cutting_gross,
        edge_length_m,
        edge_net,
        edge_gross,
        quote_edge_lines (
          edge_name,
          length_m,
          gross_price
        )
      )
    `
    )
    .eq('tenant_id', tenantId)
    .eq('id', quoteId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('getQuoteForPdf', error.message)
    throw new Error('Nem sikerült betölteni az árajánlatot a PDF-hez.')
  }
  if (!data) return null

  const customer = one(
    data.customers as
      | {
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
        }
      | {
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
        }[]
      | null
  )

  if (!customer) {
    throw new Error('Az árajánlathoz nincs ügyfél.')
  }

  type EdgeRef = { machine_code: string } | { machine_code: string }[] | null
  function edgeCode(ref: EdgeRef): string | null {
    const row = one(ref)
    const code = row?.machine_code?.trim()
    return code || null
  }

  const panelsRaw = (data.quote_panels ?? []) as Array<{
    id: string
    grain_mm: number
    cross_mm: number
    quantity: number
    label: string | null
    sort_index: number
    sheet_materials:
      | { name: string; machine_code: string | null }
      | { name: string; machine_code: string | null }[]
      | null
    edge_a: EdgeRef
    edge_b: EdgeRef
    edge_c: EdgeRef
    edge_d: EdgeRef
  }>

  const panels = [...panelsRaw]
    .sort((a, b) => a.sort_index - b.sort_index)
    .map((p) => {
      const sm = one(p.sheet_materials)
      return {
        id: p.id,
        material_machine_code: sm?.machine_code?.trim() || sm?.name || '',
        material_name: sm?.name ?? '',
        width_mm: Number(p.grain_mm),
        height_mm: Number(p.cross_mm),
        quantity: Number(p.quantity) || 0,
        label: p.label,
        edge_a_code: edgeCode(p.edge_a),
        edge_c_code: edgeCode(p.edge_c),
        edge_b_code: edgeCode(p.edge_b),
        edge_d_code: edgeCode(p.edge_d),
        duplungolas: false,
        panthelyfuras_quantity: 0,
        szogvagas: false
      }
    })

  const linesRaw = (data.quote_material_lines ?? []) as Array<{
    id: string
    material_name: string
    board_grain_mm: number
    board_cross_mm: number
    thickness_mm: number
    charged_sqm: number
    waste_multi: number
    boards_charged: number
    material_net: number
    material_gross: number
    cutting_length_m: number
    cutting_net: number
    cutting_gross: number
    edge_length_m: number
    edge_net: number
    edge_gross: number
    quote_edge_lines: Array<{
      edge_name: string
      length_m: number
      gross_price: number
    }> | null
  }>

  const pricing = linesRaw.map((line) => ({
    id: line.id,
    material_name: line.material_name,
    board_length_mm: Number(line.board_grain_mm) || 0,
    board_width_mm: Number(line.board_cross_mm) || 0,
    thickness_mm: Number(line.thickness_mm) || 0,
    charged_sqm: Number(line.charged_sqm) || 0,
    waste_multi: Number(line.waste_multi) || 1,
    boards_used: Number(line.boards_charged) || 0,
    material_net: Number(line.material_net) || 0,
    material_gross: Number(line.material_gross) || 0,
    cutting_length_m: Number(line.cutting_length_m) || 0,
    cutting_net: Number(line.cutting_net) || 0,
    cutting_gross: Number(line.cutting_gross) || 0,
    edge_materials_net: Number(line.edge_net) || 0,
    edge_materials_gross: Number(line.edge_gross) || 0,
    materials: { name: line.material_name },
    quote_edge_materials_breakdown: (line.quote_edge_lines ?? []).map((e) => ({
      edge_material_name: e.edge_name,
      total_length_m: Number(e.length_m) || 0,
      gross_price: Number(e.gross_price) || 0
    })),
    quote_services_breakdown: [] as Array<{
      service_type: string
      quantity: number
      gross_price: number
      net_price?: number
    }>
  }))

  const totalNet = Number(data.total_net) || 0
  const totalVat = Number(data.total_vat) || 0
  const totalGross = Number(data.total_gross) || 0

  return {
    id: data.id,
    quote_number: data.quote_number,
    barcode: data.barcode ?? null,
    customer: {
      name: customer.name,
      email: customer.email ?? '',
      mobile: customer.mobile ?? '',
      billing_name: customer.billing_name ?? '',
      billing_country: customer.billing_country || 'Magyarország',
      billing_city: customer.billing_city ?? '',
      billing_postal_code: customer.billing_postal_code ?? '',
      billing_street: customer.billing_street ?? '',
      billing_house_number: customer.billing_house_number ?? '',
      billing_tax_number: customer.billing_tax_number ?? ''
    },
    discount_percent: 0,
    comment: data.comment,
    created_at: data.created_at,
    pricing,
    fees: [],
    accessories: [],
    panels,
    totals: {
      total_net: totalNet,
      total_vat: totalVat,
      total_gross: totalGross,
      final_total_after_discount: totalGross,
      fees_total_gross: 0,
      accessories_total_net: 0,
      accessories_total_vat: 0,
      accessories_total_gross: 0
    }
  }
}
