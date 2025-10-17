import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server'

import { supabase } from '@/lib/supabase'

// GET - Get single unit
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching unit ${id}`)

    const { data: unit, error } = await supabase
      .from('units')
      .select('id, name, shortform, created_at, updated_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch unit' }, { status: 500 })
    }

    if (!unit) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    console.log('Unit fetched successfully:', unit)
    return NextResponse.json(unit)

  } catch (error) {
    console.error('Error fetching unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update unit
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const unitData = await request.json()

    console.log(`Updating unit ${id}:`, unitData)

    const { data: unit, error } = await supabase
      .from('units')
      .update({
        name: unitData.name,
        shortform: unitData.shortform,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, name, shortform, created_at, updated_at')
      .single()

    if (error) {
      console.error('Supabase error:', error)

      // Handle duplicate name error
      if (error.code === '23505' && error.message.includes('name')) {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy egység már létezik ezzel a névvel',
            error: 'Name already exists'
          },
          { status: 409 }
        )
      }

      return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 })
    }

    console.log('Unit updated successfully:', unit)
    
    return NextResponse.json({
      success: true,
      message: 'Unit updated successfully',
      data: unit
    })

  } catch (error) {
    console.error('Error updating unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete unit
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Soft deleting unit ${id}`)

    // Try soft delete first
    let { error } = await supabase
      .from('units')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    // If deleted_at column doesn't exist, fall back to hard delete
    if (error && error.message.includes('column "deleted_at" does not exist')) {
      console.log('deleted_at column not found, using hard delete...')

      const result = await supabase
        .from('units')
        .delete()
        .eq('id', id)

      error = result.error
    }

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 })
    }

    console.log(`Unit ${id} deleted successfully`)
    
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting unit:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
