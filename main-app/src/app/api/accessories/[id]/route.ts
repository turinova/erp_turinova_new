import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const { data, error } = await supabaseServer
      .from('accessories')
      .select(`
        id, 
        name, 
        sku, 
        barcode,
        base_price,
        multiplier,
        net_price, 
        image_url,
        created_at, 
        updated_at,
        vat_id,
        currency_id,
        units_id,
        partners_id,
        vat (
          id,
          name,
          kulcs
        ),
        currencies (
          id,
          name
        ),
        units (
          id,
          name,
          shortform
        ),
        partners (
          id,
          name
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Error fetching accessory:', error)
      return NextResponse.json({ error: 'Accessory not found' }, { status: 404 })
    }

    // Transform the data to include calculated fields
    const transformedData = {
      ...data,
      vat_name: data.vat?.name || '',
      vat_percent: data.vat?.kulcs || 0,
      currency_name: data.currencies?.name || '',
      unit_name: data.units?.name || '',
      unit_shortform: data.units?.shortform || '',
      partner_name: data.partners?.name || '',
      vat_amount: (data.net_price * (data.vat?.kulcs || 0)) / 100,
      gross_price: data.net_price + ((data.net_price * (data.vat?.kulcs || 0)) / 100)
    }

    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error in accessory GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, sku, barcode, base_price, multiplier, vat_id, currency_id, units_id, partners_id, image_url } = body

    // Validate required fields
    if (!name || !sku || base_price === undefined || multiplier === undefined || !vat_id || !currency_id || !units_id || !partners_id) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Validate base_price is a positive number
    if (typeof base_price !== 'number' || base_price < 0) {
      return NextResponse.json({ error: 'Base price must be a positive number' }, { status: 400 })
    }

    // Validate multiplier is between 1.0 and 5.0
    if (typeof multiplier !== 'number' || multiplier < 1.0 || multiplier > 5.0) {
      return NextResponse.json({ error: 'Multiplier must be between 1.0 and 5.0' }, { status: 400 })
    }

    // Calculate net_price from base_price and multiplier
    const net_price = Math.round(base_price * multiplier)

    console.log(`Updating accessory ${id}`)

    const { data, error } = await supabaseServer
      .from('accessories')
      .update({
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode ? barcode.trim() : null,
        base_price: Math.round(base_price),
        multiplier: parseFloat(multiplier.toFixed(2)),
        net_price: net_price,
        image_url: image_url || null,
        vat_id,
        currency_id,
        units_id,
        partners_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        id, 
        name, 
        sku, 
        barcode,
        base_price,
        multiplier,
        net_price, 
        image_url,
        created_at, 
        updated_at,
        vat_id,
        currency_id,
        units_id,
        partners_id,
        vat (
          id,
          name,
          kulcs
        ),
        currencies (
          id,
          name
        ),
        units (
          id,
          name,
          shortform
        ),
        partners (
          id,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Error updating accessory:', error)
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: 'SKU already exists' }, { status: 409 })
      }
      
      return NextResponse.json({ error: 'Failed to update accessory' }, { status: 500 })
    }

    // Transform the data to include calculated fields
    const transformedData = {
      ...data,
      vat_name: data.vat?.name || '',
      vat_percent: data.vat?.kulcs || 0,
      currency_name: data.currencies?.name || '',
      unit_name: data.units?.name || '',
      unit_shortform: data.units?.shortform || '',
      partner_name: data.partners?.name || '',
      vat_amount: (data.net_price * (data.vat?.kulcs || 0)) / 100,
      gross_price: data.net_price + ((data.net_price * (data.vat?.kulcs || 0)) / 100)
    }

    console.log('Accessory updated successfully:', transformedData.name)
    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error in accessory PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Deleting accessory ${id}`)

    const { data, error } = await supabaseServer
      .from('accessories')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select('name')
      .single()

    if (error) {
      console.error('Error deleting accessory:', error)
      return NextResponse.json({ error: 'Failed to delete accessory' }, { status: 500 })
    }

    console.log('Accessory deleted successfully:', data.name)
    return NextResponse.json({ message: 'Accessory deleted successfully' })

  } catch (error) {
    console.error('Error in accessory DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
