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
          sku,
          base_price,
          multiplier
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

// POST - Add an accessory or a free-typed snapshot to a quote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: quoteId } = await params
    const body = await request.json()
    const {
      accessory_id,
      quantity = 1,
      // snapshot fields for free-typed flow
      source_type,
      product_name,
      sku,
      base_price,
      multiplier,
      vat_id,
      currency_id,
      unit_id,
      partner_id
    } = body

    if (quantity < 1) {
      return NextResponse.json(
        { error: 'quantity must be at least 1' },
        { status: 400 }
      )
    }

    // Branch 1: Catalog-picked accessory
    if (accessory_id) {
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

      // Calculate totals using base_price and multiplier
      const vatRate = (accessory.vat?.kulcs || 0) / 100
      const netPrice = Math.round(accessory.base_price * accessory.multiplier)
      const totalNet = netPrice * quantity
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
          base_price: accessory.base_price,
          multiplier: accessory.multiplier,
          unit_price_net: netPrice,
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
    }

    // Branch 2: Free-typed snapshot flow
    // Validate minimal required snapshot fields
    if (!product_name || !sku) {
      return NextResponse.json(
        { error: 'product_name and sku are required for free-typed items' },
        { status: 400 }
      )
    }
    if (!base_price || base_price <= 0 || !multiplier || multiplier < 1.0 || !vat_id || !currency_id || !unit_id) {
      return NextResponse.json(
        { error: 'Missing or invalid pricing/ids for free-typed item' },
        { status: 400 }
      )
    }

    // Resolve VAT percent
    const { data: vat, error: vatError } = await supabase
      .from('vat')
      .select('id, kulcs')
      .eq('id', vat_id)
      .single()
    if (vatError || !vat) {
      return NextResponse.json({ error: 'ÁFA nem található' }, { status: 400 })
    }
    const vatRate = (vat.kulcs || 0) / 100

    // Resolve unit name
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id, name, shortform')
      .eq('id', unit_id)
      .single()
    if (unitError || !unit) {
      return NextResponse.json({ error: 'Mértékegység nem található' }, { status: 400 })
    }

    // Compute pricing
    const netPrice = Math.round(Number(base_price) * Number(multiplier))
    const totalNet = netPrice * Number(quantity)
    const totalVat = Math.round(totalNet * vatRate)
    const totalGross = totalNet + totalVat

    // Create product suggestion (pending)
    const suggestionPayload: any = {
      source_type: source_type || 'order',
      quote_id: quoteId,
      shop_order_item_id: null,
      raw_product_name: product_name,
      raw_sku: sku,
      raw_base_price: Number(base_price),
      raw_multiplier: Number(multiplier),
      raw_quantity: Number(quantity),
      raw_units_id: unit_id,
      raw_partner_id: partner_id || null,
      raw_vat_id: vat_id,
      raw_currency_id: currency_id,
      status: 'pending',
      admin_note: null
    }
    const { data: suggestion, error: suggestionError } = await supabase
      .from('product_suggestions')
      .insert(suggestionPayload)
      .select('id')
      .single()
    if (suggestionError || !suggestion) {
      console.error('Error creating product suggestion:', suggestionError)
      return NextResponse.json({ error: 'Hiba a termékjavaslat létrehozásakor' }, { status: 500 })
    }

    // Insert snapshot row into quote_accessories
    const { data: snapshotRow, error: snapshotError } = await supabase
      .from('quote_accessories')
      .insert({
        quote_id: quoteId,
        accessory_id: null,
        product_suggestion_id: suggestion.id,
        quantity: Number(quantity),
        accessory_name: product_name,
        sku: sku,
        base_price: Number(base_price),
        multiplier: Number(multiplier),
        unit_price_net: netPrice,
        vat_rate: vatRate,
        unit_id: unit_id,
        unit_name: unit.name || '',
        currency_id: currency_id,
        total_net: totalNet,
        total_vat: totalVat,
        total_gross: totalGross
      })
      .select()
      .single()

    if (snapshotError) {
      console.error('Error inserting snapshot accessory:', snapshotError)
      return NextResponse.json({ error: snapshotError.message }, { status: 500 })
    }

    // Recalculate quote totals
    await recalculateQuoteTotals(quoteId)

    return NextResponse.json(snapshotRow, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/quotes/[id]/accessories:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

