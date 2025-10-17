import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - Get single fee type by ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    console.log(`Fetching fee type ${id}`)
    
    const { data: feeType, error } = await supabaseServer
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
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Fee type not found' }, { status: 404 })
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

    console.log(`Fee type fetched successfully: ${transformedData.name}`)
    
    return NextResponse.json(transformedData)
    
  } catch (error) {
    console.error('Error fetching fee type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT - Update fee type
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log(`Updating fee type ${id}`)

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

    const updateData = {
      name: feeTypeData.name,
      net_price: feeTypeData.net_price,
      vat_id: feeTypeData.vat_id,
      currency_id: feeTypeData.currency_id,
      updated_at: new Date().toISOString()
    }

    const { data: feeType, error } = await supabaseServer
      .from('feetypes')
      .update(updateData)
      .eq('id', id)
      .is('deleted_at', null)
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

      return NextResponse.json({ error: 'Failed to update fee type' }, { status: 500 })
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

    console.log(`Fee type updated successfully: ${transformedData.name}`)

    return NextResponse.json(
      {
        success: true,
        message: 'Fee type updated successfully',
        data: transformedData
      }
    )

  } catch (error) {
    console.error('Error updating fee type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Soft delete fee type
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    console.log(`Deleting fee type ${id}`)

    const { error } = await supabaseServer
      .from('feetypes')
      .update({ 
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to delete fee type' }, { status: 500 })
    }

    console.log(`Fee type deleted successfully: ${id}`)

    return NextResponse.json(
      {
        success: true,
        message: 'Fee type deleted successfully'
      }
    )

  } catch (error) {
    console.error('Error deleting fee type:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
