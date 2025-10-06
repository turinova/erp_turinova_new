import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - Get single quote with all data
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching quote ${id}`)

    // Fetch quote with customer data
    const { data: quote, error: quoteError } = await supabaseServer
      .from('quotes')
      .select(`
        id,
        quote_number,
        status,
        customer_id,
        discount_percent,
        total_net,
        total_vat,
        total_gross,
        final_total_after_discount,
        created_at,
        updated_at,
        customers(
          id,
          name,
          email,
          mobile,
          discount_percent,
          billing_name,
          billing_country,
          billing_city,
          billing_postal_code,
          billing_street,
          billing_house_number,
          billing_tax_number,
          billing_company_reg_number
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (quoteError) {
      console.error('Error fetching quote:', quoteError)
      
      if (quoteError.code === 'PGRST116' || quoteError.message.includes('No rows found')) {
        return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
      }
      
      return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 })
    }

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Fetch panels for this quote
    const { data: panels, error: panelsError } = await supabaseServer
      .from('quote_panels')
      .select(`
        id,
        material_id,
        width_mm,
        height_mm,
        quantity,
        label,
        edge_material_a_id,
        edge_material_b_id,
        edge_material_c_id,
        edge_material_d_id,
        panthelyfuras_quantity,
        panthelyfuras_oldal,
        duplungolas,
        szogvagas,
        materials(id, name, brand_id, length_mm, width_mm, brands(name))
      `)
      .eq('quote_id', id)
      .order('created_at', { ascending: true })

    if (panelsError) {
      console.error('Error fetching panels:', panelsError)
      return NextResponse.json({ error: 'Failed to fetch quote panels' }, { status: 500 })
    }

    // Transform the response to include all necessary data
    const transformedQuote = {
      id: quote.id,
      quote_number: quote.quote_number,
      status: quote.status,
      customer_id: quote.customer_id,
      discount_percent: quote.discount_percent,
      customer: quote.customers,
      panels: panels || [],
      totals: {
        total_net: quote.total_net,
        total_vat: quote.total_vat,
        total_gross: quote.total_gross,
        final_total_after_discount: quote.final_total_after_discount
      },
      created_at: quote.created_at,
      updated_at: quote.updated_at
    }

    console.log(`Quote fetched successfully: ${quote.quote_number} with ${panels?.length || 0} panels`)
    
    return NextResponse.json(transformedQuote)

  } catch (error) {
    console.error('Error fetching quote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

