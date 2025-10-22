import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Get single edge material
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params


    const { data: edgeMaterial, error } = await supabase
      .from('edge_materials')
      .select(`
        id,
        brand_id,
        type,
        thickness,
        width,
        decor,
        price,
        vat_id,
        active,
        ráhagyás,
        favourite_priority,
        created_at,
        updated_at,
        brands (
          name
        ),
        vat (
          name,
          kulcs
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      
      if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
        return NextResponse.json({ error: 'Edge material not found' }, { status: 404 })
      }
      
      return NextResponse.json({ error: 'Failed to fetch edge material' }, { status: 500 })
    }

    // Fetch machine code from machine_edge_material_map
    const { data: machineData } = await supabase
      .from('machine_edge_material_map')
      .select('machine_code')
      .eq('edge_material_id', id)
      .eq('machine_type', 'Korpus')
      .single()

    return NextResponse.json({
      ...edgeMaterial,
      machine_code: machineData?.machine_code || ''
    })

  } catch (error) {
    console.error('Error fetching edge material:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update edge material
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    
    // Prepare data for update
    const updateData = {
      brand_id: body.brand_id || '',
      type: body.type || '',
      thickness: parseFloat(body.thickness) || 0,
      width: parseFloat(body.width) || 0,
      decor: body.decor || '',
      price: parseFloat(body.price) || 0,
      vat_id: body.vat_id || '',
      active: body.active !== undefined ? body.active : true,
      ráhagyás: parseInt(body.ráhagyás) || 0,
      favourite_priority: body.favourite_priority !== undefined ? body.favourite_priority : null,
      updated_at: new Date().toISOString()
    }

    const { data: edgeMaterial, error } = await supabase
      .from('edge_materials')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        brand_id,
        type,
        thickness,
        width,
        decor,
        price,
        vat_id,
        active,
        ráhagyás,
        favourite_priority,
        created_at,
        updated_at,
        brands (
          name
        ),
        vat (
          name,
          kulcs
        )
      `)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      
      // Handle specific error cases
      if (error.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy élzáró már létezik ezekkel az adatokkal',
            error: 'Duplicate entry'
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ 
        error: 'Failed to update edge material', 
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    // Handle machine_code mapping (upsert)
    const machineCode = body.machine_code || ''
    
    if (machineCode.trim()) {
      // Upsert machine code mapping
      await supabase
        .from('machine_edge_material_map')
        .upsert({
          edge_material_id: id,
          machine_type: 'Korpus',
          machine_code: machineCode
        }, {
          onConflict: 'edge_material_id,machine_type'
        })
    } else {
      // If machine code is empty, keep the existing mapping or create empty one
      await supabase
        .from('machine_edge_material_map')
        .upsert({
          edge_material_id: id,
          machine_type: 'Korpus',
          machine_code: ''
        }, {
          onConflict: 'edge_material_id,machine_type'
        })
    }

    
    return NextResponse.json({
      success: true,
      message: 'Edge material updated successfully',
      data: edgeMaterial
    })
  } catch (error) {
    console.error('Error updating edge material:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete edge material
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params


    // Try soft delete first
    let { error } = await supabase
      .from('edge_materials')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    // If deleted_at column doesn't exist, fall back to hard delete
    if (error && error.message.includes('column "deleted_at" does not exist')) {

      const result = await supabase
        .from('edge_materials')
        .delete()
        .eq('id', id)

      error = result.error
    }

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete edge material' }, { status: 500 })
    }

    
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting edge material:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
