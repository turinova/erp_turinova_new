import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recalculateQuoteTotals } from '../fees/route'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// GET all accessories for a quote
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data: accessories, error } = await supabase
      .from('quote_accessories')
      .select(`
        *,
        accessories (
          id,
          name,
          sku
        ),
        units (
          id,
          name,
          shortform
        ),
        currencies (
          id,
          name
        )
      `)
      .eq('quote_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching quote accessories:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(accessories || [])
  } catch (error) {
    console.error('Error in GET /api/quotes/[id]/accessories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Add an accessory to a quote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
    const body = await request.json()
    const { accessory_id, quantity = 1 } = body

    if (!accessory_id) {
      return NextResponse.json(
        { error: 'accessory_id is required' },
        { status: 400 }
      )
    }

    if (quantity < 1) {
      return NextResponse.json(
        { error: 'quantity must be at least 1' },
        { status: 400 }
      )
    }

    // Fetch accessory details
    const { data: accessory, error: accessoryError } = await supabase
      .from('accessories')
      .select(`
        *,
        vat (kulcs),
        currencies (id, name),
        units (id, name, shortform)
      `)
      .eq('id', accessory_id)
      .is('deleted_at', null)
      .single()

    if (accessoryError || !accessory) {
      return NextResponse.json(
        { error: 'Accessory not found' },
        { status: 404 }
      )
    }

    // Calculate totals
    const vatRate = (accessory.vat?.kulcs || 0) / 100
    const totalNet = accessory.net_price * quantity
    const totalVat = totalNet * vatRate
    const totalGross = totalNet + totalVat

    // Insert accessory
    const { data: newAccessory, error: insertError } = await supabase
      .from('quote_accessories')
      .insert({
        quote_id: quoteId,
        accessory_id: accessory_id,
        quantity: quantity,
        accessory_name: accessory.name,
        sku: accessory.sku,
        unit_price_net: accessory.net_price,
        vat_rate: vatRate,
        unit_id: accessory.units_id,
        unit_name: accessory.units?.name || '',
        currency_id: accessory.currency_id,
        total_net: totalNet,
        total_vat: totalVat,
        total_gross: totalGross
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting accessory:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Recalculate quote totals
    await recalculateQuoteTotals(quoteId)

    return NextResponse.json(newAccessory, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/quotes/[id]/accessories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

