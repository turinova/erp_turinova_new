import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching all VAT rates...')

    // Single optimized query with all columns
    const { data: vatRates, error } = await supabase
      .from('vat')
      .select('id, name, kulcs, created_at, updated_at, deleted_at')
      .is('deleted_at', null) // Only fetch active records
      .order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch VAT rates' }, { status: 500 })
    }

    console.log(`Fetched ${vatRates?.length || 0} VAT rates successfully`)
    return NextResponse.json(vatRates || [])

  } catch (error) {
    console.error('Error fetching VAT rates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Creating new VAT rate...')

    const vatData = await request.json()

    const newVat = {
      name: vatData.name || '',
      kulcs: parseFloat(vatData.kulcs) || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: vat, error } = await supabase
      .from('vat')
      .insert([newVat])
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)

      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy adónem már létezik ezzel a névvel',
            error: 'Name already exists'
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: 'Failed to create VAT rate' }, { status: 500 })
    }

    console.log('VAT rate created successfully:', vat)

    return NextResponse.json(
      {
        success: true,
        message: 'VAT rate created successfully',
        vat: vat
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating VAT rate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
