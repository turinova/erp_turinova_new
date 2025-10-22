import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - List all fee types with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    console.log('Fetching fee types...', searchQuery ? `with search: ${searchQuery}` : '')
    
    let query = supabaseServer
      .from('feetypes')
      .select(`
        id, 
        name, 
        net_price, 
        created_at, 
        updated_at,
        vat_id,
        currency_id,
        vat (
          id,
          name,
          kulcs
        ),
        currencies (
          id,
          name
        )
      `)
      .is('deleted_at', null)
    
    // Add search filtering if query parameter exists
    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`)
    }
    
    const { data: feeTypes, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch fee types' }, { status: 500 })
    }

    // Transform the data to include calculated fields
    const transformedData = feeTypes?.map(feeType => ({
      ...feeType,
      vat_name: feeType.vat?.name || '',
      vat_percent: feeType.vat?.kulcs || 0,
      currency_name: feeType.currencies?.name || '',
      vat_amount: (feeType.net_price * (feeType.vat?.kulcs || 0)) / 100,
      gross_price: feeType.net_price + ((feeType.net_price * (feeType.vat?.kulcs || 0)) / 100)
    })) || []

    console.log(`Fetched ${transformedData?.length || 0} fee types successfully`)
    
    // Add cache control headers for dynamic ERP data
    const response = NextResponse.json(transformedData)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
    
  } catch (error) {
    console.error('Error fetching fee types:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new fee type
export async function POST(request: NextRequest) {
  try {
    console.log('Creating new fee type...')

    const feeTypeData = await request.json()

    // Validate required fields
    if (!feeTypeData.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (feeTypeData.net_price === undefined || feeTypeData.net_price === null) {
      return NextResponse.json({ error: 'Net price is required' }, { status: 400 })
    }

    if (!feeTypeData.vat_id) {
      return NextResponse.json({ error: 'VAT is required' }, { status: 400 })
    }

    if (!feeTypeData.currency_id) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 })
    }

    const newFeeType = {
      name: feeTypeData.name || '',
      net_price: feeTypeData.net_price || 0,
      vat_id: feeTypeData.vat_id,
      currency_id: feeTypeData.currency_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: feeType, error } = await supabaseServer
      .from('feetypes')
      .insert([newFeeType])
      .select(`
        id, 
        name, 
        net_price, 
        created_at, 
        updated_at,
        vat_id,
        currency_id,
        vat (
          id,
          name,
          kulcs
        ),
        currencies (
          id,
          name
        )
      `)
      .single()

    if (error) {
      console.error('Supabase error:', error)

      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy díj típus már létezik ezzel a névvel',
            error: 'Fee type name already exists'
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: 'Failed to create fee type' }, { status: 500 })
    }

    // Transform the data to include calculated fields
    const transformedData = {
      ...feeType,
      vat_name: feeType.vat?.name || '',
      vat_percent: feeType.vat?.kulcs || 0,
      currency_name: feeType.currencies?.name || '',
      vat_amount: (feeType.net_price * (feeType.vat?.kulcs || 0)) / 100,
      gross_price: feeType.net_price + ((feeType.net_price * (feeType.vat?.kulcs || 0)) / 100)
    }

    console.log('Fee type created successfully:', transformedData)

    return NextResponse.json(
      {
        success: true,
        message: 'Fee type created successfully',
        data: transformedData
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating fee type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
