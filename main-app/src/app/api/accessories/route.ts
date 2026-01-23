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
        gross_price,
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
    // Use stored gross_price if available, otherwise calculate as fallback
    const transformedData = data?.map(accessory => {
      const calculatedGrossPrice = accessory.net_price + ((accessory.net_price * (accessory.vat?.kulcs || 0)) / 100)
      const finalGrossPrice = accessory.gross_price !== null ? accessory.gross_price : calculatedGrossPrice
      
      return {
        ...accessory,
        vat_name: accessory.vat?.name || '',
        vat_percent: accessory.vat?.kulcs || 0,
        currency_name: accessory.currencies?.name || '',
        unit_name: accessory.units?.name || '',
        unit_shortform: accessory.units?.shortform || '',
        partner_name: accessory.partners?.name || '',
        vat_amount: (accessory.net_price * (accessory.vat?.kulcs || 0)) / 100,
        gross_price: finalGrossPrice
      }
    }) || []

    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error in accessories GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, sku, barcode, barcode_u, base_price, multiplier, net_price, gross_price, vat_id, currency_id, units_id, partners_id, image_url } = body

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

    // Calculate net_price if not provided
    let finalNetPrice = net_price
    if (finalNetPrice === undefined || finalNetPrice === null) {
      finalNetPrice = Math.round(base_price * multiplier)
    } else {
      finalNetPrice = Math.round(finalNetPrice)
    }

    // Calculate gross_price: use provided value or calculate from net_price + VAT
    let finalGrossPrice = gross_price
    if (finalGrossPrice === undefined || finalGrossPrice === null) {
      const { data: vatData } = await supabaseServer
        .from('vat')
        .select('kulcs')
        .eq('id', vat_id)
        .single()
      
      if (vatData) {
        finalGrossPrice = Math.round(finalNetPrice + (finalNetPrice * vatData.kulcs / 100))
      } else {
        finalGrossPrice = finalNetPrice
      }
    } else {
      finalGrossPrice = Math.round(finalGrossPrice)
    }

    console.log('Creating new accessory...')

    const { data, error } = await supabaseServer
      .from('accessories')
      .insert({
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode ? barcode.trim() : null,
        barcode_u: barcode_u ? barcode_u.trim() : null,
        base_price: Math.round(base_price), // Convert to integer
        multiplier: parseFloat(multiplier.toFixed(3)), // Round to 3 decimal places
        net_price: finalNetPrice, // Convert to integer
        gross_price: finalGrossPrice,
        image_url: image_url || null,
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
        gross_price,
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
    // Use stored gross_price if available, otherwise calculate as fallback
    const calculatedGrossPrice = data.net_price + ((data.net_price * (data.vat?.kulcs || 0)) / 100)
    const finalGrossPrice = data.gross_price !== null ? data.gross_price : calculatedGrossPrice
    
    const transformedData = {
      ...data,
      vat_name: data.vat?.name || '',
      vat_percent: data.vat?.kulcs || 0,
      currency_name: data.currencies?.name || '',
      unit_name: data.units?.name || '',
      unit_shortform: data.units?.shortform || '',
      partner_name: data.partners?.name || '',
      vat_amount: (data.net_price * (data.vat?.kulcs || 0)) / 100,
      gross_price: finalGrossPrice
    }

    console.log('Accessory created successfully:', transformedData.name)
    return NextResponse.json(transformedData, { status: 201 })

  } catch (error) {
    console.error('Error in accessories POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
