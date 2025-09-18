import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - List all currencies with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    console.log('Fetching currencies...', searchQuery ? `with search: ${searchQuery}` : '')
    
    let query = supabase
      .from('currencies')
      .select('id, name, rate, created_at, updated_at')
      .is('deleted_at', null)
    
    // Add search filtering if query parameter exists
    if (searchQuery) {
      query = query.or(`name.ilike.%${searchQuery}%,rate.eq.${parseFloat(searchQuery) || 0}`)
    }
    
    const { data: currencies, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch currencies' }, { status: 500 })
    }

    console.log(`Fetched ${currencies?.length || 0} currencies successfully`)
    return NextResponse.json(currencies || [])
    
  } catch (error) {
    console.error('Error fetching currencies:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new currency
export async function POST(request: NextRequest) {
  try {
    console.log('Creating new currency...')

    const currencyData = await request.json()

    // Validate required fields
    if (!currencyData.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const newCurrency = {
      name: currencyData.name || '',
      rate: parseFloat(currencyData.rate) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: currency, error } = await supabase
      .from('currencies')
      .insert([newCurrency])
      .select('id, name, rate, created_at, updated_at')
      .single()

    if (error) {
      console.error('Supabase error:', error)

      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy pénznem már létezik ezzel a névvel',
            error: 'Name already exists'
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: 'Failed to create currency' }, { status: 500 })
    }

    console.log('Currency created successfully:', currency)

    return NextResponse.json(
      {
        success: true,
        message: 'Currency created successfully',
        data: currency
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating currency:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
