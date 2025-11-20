import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    let query = supabaseAdmin
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

    return NextResponse.json(transformedData)
    
  } catch (error) {
    console.error('Error fetching fee types:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

