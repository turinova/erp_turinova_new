import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching VAT rate ${id}`)

    const { data: vat, error } = await supabase
      .from('vat')
      .select('id, name, kulcs, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      
return NextResponse.json({ error: 'Failed to fetch VAT rate' }, { status: 500 })
    }

    if (!vat) {
      return NextResponse.json({ error: 'VAT rate not found' }, { status: 404 })
    }

    console.log('VAT rate fetched successfully:', vat)
    
return NextResponse.json(vat)

  } catch (error) {
    console.error('Error fetching VAT rate:', error)
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const vatData = await request.json()

    console.log(`Updating VAT rate ${id}:`, vatData)

    const { data: vat, error } = await supabase
      .from('vat')
      .update({
        name: vatData.name,
        kulcs: parseFloat(vatData.kulcs) || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, name, kulcs, created_at, updated_at')
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

      return NextResponse.json({ error: 'Failed to update VAT rate' }, { status: 500 })
    }

    console.log('VAT rate updated successfully:', vat)
    
return NextResponse.json({
      success: true,
      message: 'VAT rate updated successfully',
      data: vat
    })

  } catch (error) {
    console.error('Error updating VAT rate:', error)
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Soft deleting VAT rate ${id}`)

    // Try soft delete first
    let { error } = await supabase
      .from('vat')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    // If deleted_at column doesn't exist, fall back to hard delete
    if (error && error.message.includes('column "deleted_at" does not exist')) {
      console.log('deleted_at column not found, using hard delete...')

      const result = await supabase
        .from('vat')
        .delete()
        .eq('id', id)

      error = result.error
    }

    if (error) {
      console.error('Supabase delete error:', error)
      
return NextResponse.json({ error: 'Failed to delete VAT rate' }, { status: 500 })
    }

    console.log(`VAT rate ${id} deleted successfully`)
    
return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting VAT rate:', error)
    
return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
