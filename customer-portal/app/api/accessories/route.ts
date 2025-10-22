import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('search')

    let query = supabaseServer
      .from('accessories')
      .select(`
        id, 
        name, 
        sku, 
        base_price,
        multiplier,
        net_price, 
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
      .is('deleted_at', null)
      .order('name', { ascending: true })

    // Apply search filter if provided
    if (searchTerm && searchTerm.trim()) {
      query = query.or(`name.ilike.%${searchTerm.trim()}%,sku.ilike.%${searchTerm.trim()}%`)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching accessories:', error)
      return NextResponse.json({ error: 'Failed to fetch accessories' }, { status: 500 })
    }

    // Transform the data to include calculated fields
    const transformedData = data?.map(accessory => ({
      ...accessory,
      vat_name: accessory.vat?.name || '',
      vat_percent: accessory.vat?.kulcs || 0,
      currency_name: accessory.currencies?.name || '',
      unit_name: accessory.units?.name || '',
      unit_shortform: accessory.units?.shortform || '',
      partner_name: accessory.partners?.name || '',
      vat_amount: (accessory.net_price * (accessory.vat?.kulcs || 0)) / 100,
      gross_price: accessory.net_price + ((accessory.net_price * (accessory.vat?.kulcs || 0)) / 100)
    })) || []

    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error in accessories GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, sku, base_price, multiplier, net_price, vat_id, currency_id, units_id, partners_id } = body

    // Validate required fields
    if (!name || !sku || base_price === undefined || multiplier === undefined || !vat_id || !currency_id || !units_id || !partners_id) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 })
    }

    // Validate base_price is a positive number
    if (typeof base_price !== 'number' || base_price < 0) {
      return NextResponse.json({ error: 'Base price must be a positive number' }, { status: 400 })
    }

    // Validate multiplier is within range
    if (typeof multiplier !== 'number' || multiplier < 1.0 || multiplier > 5.0) {
      return NextResponse.json({ error: 'Multiplier must be between 1.0 and 5.0' }, { status: 400 })
    }

    console.log('Creating new accessory...')

    const { data, error } = await supabaseServer
      .from('accessories')
      .insert({
        name: name.trim(),
        sku: sku.trim(),
        base_price: Math.round(base_price), // Convert to integer
        multiplier: parseFloat(multiplier.toFixed(2)), // Round to 2 decimal places
        net_price: Math.round(net_price), // Convert to integer
        vat_id,
        currency_id,
        units_id,
        partners_id
      })
      .select(`
        id, 
        name, 
        sku, 
        base_price,
        multiplier,
        net_price, 
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
      console.error('Error creating accessory:', error)
      
      // Handle unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: 'SKU already exists' }, { status: 409 })
      }
      
      return NextResponse.json({ error: 'Failed to create accessory' }, { status: 500 })
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

    console.log('Accessory created successfully:', transformedData.name)
    return NextResponse.json(transformedData, { status: 201 })

  } catch (error) {
    console.error('Error in accessories POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
