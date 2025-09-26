import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    const { data: brand, error } = await supabase
      .from('brands')
      .select('id, name, comment, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch brand' }, { status: 500 })
    }
    
    if (!brand) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }
    
    return NextResponse.json(brand)
    
  } catch (error) {
    console.error('Error fetching brand:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const brandData = await request.json()
    
    const { data: brand, error } = await supabase
      .from('brands')
      .update({
        name: brandData.name,
        comment: brandData.comment,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, name, comment, created_at, updated_at')
      .single()
    
    if (error) {
      console.error('Supabase error:', error)
      
      // Handle duplicate name error specifically
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Egy gyártó már létezik ezzel a névvel',
            error: 'Name already exists' 
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ error: 'Failed to update brand' }, { status: 500 })
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Brand updated successfully',
      brand: brand 
    })
    
  } catch (error) {
    console.error('Error updating brand:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    
    // Try soft delete first
    let { error } = await supabase
      .from('brands')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    // If deleted_at column doesn't exist, fall back to hard delete
    if (error && error.message.includes('column "deleted_at" does not exist')) {
      const result = await supabase
        .from('brands')
        .delete()
        .eq('id', id)
      
      error = result.error
    }

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete brand' }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error) {
    console.error('Error deleting brand:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
