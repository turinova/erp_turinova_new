import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all currencies...')

    // Single optimized query with all columns
    const { data: currencies, error } = await supabase
      .from('currencies')
      .select('id, name, rate, created_at, updated_at, deleted_at')
      .is('deleted_at', null) // Only fetch active records
      .order('name', { ascending: true })

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

export async function POST(request: NextRequest) {
  try {
    console.log('Creating new currency...')

    const currencyData = await request.json()

    const newCurrency = {
      name: currencyData.name || '',
      rate: parseFloat(currencyData.rate) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: currency, error } = await supabase
      .from('currencies')
      .insert([newCurrency])
      .select()
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
        currency: currency
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating currency:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
