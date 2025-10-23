import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching payment method ${id}`)

    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .select('id, name, comment, active, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch payment method' }, { status: 500 })
    }

    if (!paymentMethod) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 })
    }

    console.log('Payment method fetched successfully:', paymentMethod)
    return NextResponse.json(paymentMethod)

  } catch (error) {
    console.error('Error fetching payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const paymentMethodData = await request.json()

    console.log(`Updating payment method ${id}:`, paymentMethodData)

    // Validate name length
    if (paymentMethodData.name && paymentMethodData.name.length > 50) {
      return NextResponse.json({ error: 'A név maximum 50 karakter lehet' }, { status: 400 })
    }

    const { data: paymentMethod, error } = await supabase
      .from('payment_methods')
      .update({
        name: paymentMethodData.name,
        comment: paymentMethodData.comment || null,
        active: paymentMethodData.active !== undefined ? paymentMethodData.active : true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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

      return NextResponse.json({ error: 'Failed to update payment method' }, { status: 500 })
    }

    console.log('Payment method updated successfully:', paymentMethod)
    
    return NextResponse.json({
      success: true,
      message: 'Fizetési mód sikeresen frissítve',
      data: paymentMethod
    })

  } catch (error) {
    console.error('Error updating payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Soft deleting payment method ${id}`)

    // Soft delete (set deleted_at timestamp)
    const { error } = await supabase
      .from('payment_methods')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 })
    }

    console.log(`Payment method ${id} deleted successfully`)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting payment method:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

