import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

// GET - Get single currency
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching currency ${id}`)

    const { data: currency, error } = await supabase
      .from('currencies')
      .select('id, name, rate, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch currency' }, { status: 500 })
    }

    if (!currency) {
      return NextResponse.json({ error: 'Currency not found' }, { status: 404 })
    }

    console.log('Currency fetched successfully:', currency)
    return NextResponse.json(currency)

  } catch (error) {
    console.error('Error fetching currency:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update currency
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const currencyData = await request.json()

    console.log(`Updating currency ${id}:`, currencyData)

    const { data: currency, error } = await supabase
      .from('currencies')
      .update({
        name: currencyData.name,
        rate: parseFloat(currencyData.rate) || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
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

      return NextResponse.json({ error: 'Failed to update currency' }, { status: 500 })
    }

    console.log('Currency updated successfully:', currency)
    
    return NextResponse.json({
      success: true,
      message: 'Currency updated successfully',
      data: currency
    })

  } catch (error) {
    console.error('Error updating currency:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete currency
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Soft deleting currency ${id}`)

    // Try soft delete first
    let { error } = await supabase
      .from('currencies')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    // If deleted_at column doesn't exist, fall back to hard delete
    if (error && error.message.includes('column "deleted_at" does not exist')) {
      console.log('deleted_at column not found, using hard delete...')

      const result = await supabase
        .from('currencies')
        .delete()
        .eq('id', id)

      error = result.error
    }

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete currency' }, { status: 500 })
    }

    console.log(`Currency ${id} deleted successfully`)
    
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting currency:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
