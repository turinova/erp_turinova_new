import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    console.log('Fetching payment methods...', searchQuery ? `with search: ${searchQuery}` : '')

    let query = supabaseServer
      .from('payment_methods')
      .select('id, name, comment, active, created_at, updated_at')
      .is('deleted_at', null)
    
    // Add search filtering if query parameter exists (search by name only)
    if (searchQuery) {
      query = query.ilike('name', `%${searchQuery}%`)
    }
    
    const { data: paymentMethods, error } = await query.order('name', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 })
    }

    console.log(`Fetched ${paymentMethods?.length || 0} payment methods successfully`)
    
    // Add cache control headers for dynamic ERP data
    const response = NextResponse.json(paymentMethods || [])
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response

  } catch (error) {
    console.error('Error fetching payment methods:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Creating new payment method...')

    const paymentMethodData = await request.json()

    // Validate required fields
    if (!paymentMethodData.name) {
      return NextResponse.json({ error: 'Név kötelező mező' }, { status: 400 })
    }

    // Validate name length
    if (paymentMethodData.name.length > 50) {
      return NextResponse.json({ error: 'A név maximum 50 karakter lehet' }, { status: 400 })
    }

    const newPaymentMethod = {
      name: paymentMethodData.name,
      comment: paymentMethodData.comment || null,
      active: paymentMethodData.active !== undefined ? paymentMethodData.active : true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: paymentMethod, error } = await supabaseServer
      .from('payment_methods')
      .insert([newPaymentMethod])
      .select('id, name, comment, active, created_at, updated_at')
      .single()

    if (error) {
      console.error('Supabase error:', error)

      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy fizetési mód már létezik ezzel a névvel',
            error: 'Name already exists'
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: 'Failed to create payment method' }, { status: 500 })
    }

    console.log('Payment method created successfully:', paymentMethod)

    return NextResponse.json(
      {
        success: true,
        message: 'Fizetési mód sikeresen létrehozva',
        data: paymentMethod
      },
      { status: 201 }
    )

  } catch (error) {
    console.error('Error creating payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

