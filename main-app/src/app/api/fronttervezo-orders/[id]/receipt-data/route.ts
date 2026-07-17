import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getFronttervezoQuoteById, getTenantCompany } from '@/lib/supabase-server'

/**
 * GET /api/fronttervezo-orders/[id]/receipt-data
 * Opti-kompatibilis nyugta adat (printOrderReceipt / ESC/POS)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const [quote, tenantCompany] = await Promise.all([
      getFronttervezoQuoteById(id),
      getTenantCompany()
    ])

    if (!quote) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const finishLabel = (finish: string | null | undefined) => {
      if (finish === 'hg') return 'Fényes'
      if (finish === 'matt') return 'Matt'
      return null
    }

    const skuSummary = (quote.sku_summary || []) as Array<{
      id: string
      display_name: string
      finish: string | null
      panels_db: number
      total_sqm: number
    }>

    const services = (quote.services || []) as Array<{
      id: string
      service_type: string
      quantity: number
      unit_price_net: number
      net: number
      vat: number
      gross: number
    }>

    const fees = (quote.fees || []) as Array<{
      id: string
      fee_name: string
      quantity: number
      unit_price_net: number
      gross_price: number
    }>

    const serviceBreakdown = [
      ...services.map(s => ({
        id: s.id,
        service_type: s.service_type,
        quantity: Number(s.quantity) || 0,
        unit_price: Number(s.unit_price_net) || 0,
        net_price: Number(s.net) || 0,
        vat_amount: Number(s.vat) || 0,
        gross_price: Number(s.gross) || 0
      })),
      ...fees.map(f => ({
        id: f.id,
        service_type: f.fee_name || 'Díj',
        quantity: Number(f.quantity) || 1,
        unit_price: Number(f.unit_price_net) || 0,
        net_price: Number(f.unit_price_net) * (Number(f.quantity) || 1),
        vat_amount: 0,
        gross_price: Number(f.gross_price) || 0
      }))
    ]

    const pricing =
      skuSummary.length > 0
        ? skuSummary.map((sku, index) => {
            const finish = finishLabel(sku.finish)
            const materialName = finish
              ? `${sku.display_name} (${finish})`
              : sku.display_name

            return {
              id: sku.id,
              material_name: materialName,
              charged_sqm: Number(sku.total_sqm) || 0,
              boards_used: Number(sku.panels_db) || 0,
              waste_multi: 1,
              quote_edge_materials_breakdown: [],
              quote_services_breakdown: index === 0 ? serviceBreakdown : []
            }
          })
        : [
            {
              id: 'empty',
              material_name: 'Front tételek',
              charged_sqm: 0,
              boards_used: 0,
              waste_multi: 1,
              quote_edge_materials_breakdown: [],
              quote_services_breakdown: serviceBreakdown
            }
          ]

    // Ha nincs SKU, de van szolgáltatás — boards_used=0 waste=1 → worktop mód "0.00 m"
    // Állítsunk 1 db-ot, hogy ne legyen üres mennyiség
    if (skuSummary.length === 0 && pricing[0]) {
      pricing[0].boards_used = 1
      pricing[0].charged_sqm = 1
    }

    return NextResponse.json({
      id: quote.id,
      quote_number: quote.quote_number,
      order_number: quote.order_number,
      barcode: quote.barcode || null,
      customer: quote.customer,
      final_total_after_discount: quote.final_total_after_discount,
      pricing,
      tenant_company: tenantCompany
        ? {
            name: tenantCompany.name,
            logo_url: tenantCompany.logo_url,
            postal_code: tenantCompany.postal_code,
            city: tenantCompany.city,
            address: tenantCompany.address,
            phone_number: tenantCompany.phone_number,
            email: tenantCompany.email,
            tax_number: tenantCompany.tax_number
          }
        : null
    })
  } catch (error) {
    console.error('[FT receipt-data]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
