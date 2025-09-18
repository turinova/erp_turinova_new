import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Get single material
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching material ${id}`)

    // Fetch material from materials_with_settings view
    const { data, error } = await supabase
      .from('materials_with_settings')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      
      if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
        return NextResponse.json({ error: 'Material not found' }, { status: 404 })
      }
      
      return NextResponse.json({ error: 'Failed to fetch material' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    // Fetch brand_id from materials table
    const { data: materialData } = await supabase
      .from('materials')
      .select('brand_id')
      .eq('id', id)
      .single()

    // Fetch machine code from machine_material_map
    const { data: machineData } = await supabase
      .from('machine_material_map')
      .select('machine_code')
      .eq('material_id', id)
      .eq('machine_type', 'Korpus')
      .single()

    // Transform the data to match the expected format
    const transformedData = {
      id: data.id,
      name: data.material_name || `Material ${data.id}`,
      length_mm: data.length_mm || 2800,
      width_mm: data.width_mm || 2070,
      thickness_mm: data.thickness_mm || 18,
      grain_direction: Boolean(data.grain_direction),
      on_stock: data.on_stock !== undefined ? Boolean(data.on_stock) : true,
      image_url: data.image_url || null,
      brand_id: materialData?.brand_id || '',
      brand_name: data.brand_name || 'Unknown',
      kerf_mm: data.kerf_mm || 3,
      trim_top_mm: data.trim_top_mm || 0,
      trim_right_mm: data.trim_right_mm || 0,
      trim_bottom_mm: data.trim_bottom_mm || 0,
      trim_left_mm: data.trim_left_mm || 0,
      rotatable: data.rotatable !== false,
      waste_multi: data.waste_multi || 1.0,
      machine_code: machineData?.machine_code || '',
      created_at: data.created_at,
      updated_at: data.updated_at
    }

    console.log(`Material fetched successfully: ${transformedData.name}`)
    return NextResponse.json(transformedData)

  } catch (error) {
    console.error('Error fetching material:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH - Update material
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()

    console.log(`Updating material ${id}:`, body)
    
    // Update the materials table
    const { data: materialData, error: materialError } = await supabase
      .from('materials')
      .update({
        name: body.name,
        length_mm: body.length_mm,
        width_mm: body.width_mm,
        thickness_mm: body.thickness_mm,
        grain_direction: body.grain_direction,
        on_stock: body.on_stock,
        image_url: body.image_url || null,
        brand_id: body.brand_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (materialError) {
      console.error('Supabase error:', materialError)
      
      // Handle specific error cases
      if (materialError.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            message: 'Egy anyag már létezik ezzel a névvel',
            error: 'Name already exists'
          },
          { status: 409 }
        )
      }
      
      return NextResponse.json({ 
        error: 'Failed to update material', 
        details: materialError.message,
        code: materialError.code
      }, { status: 500 })
    }

    // Update the material_settings table using upsert with proper conflict resolution
    const { data: settingsData, error: settingsError } = await supabase
      .from('material_settings')
      .upsert({
        material_id: id,
        kerf_mm: body.kerf_mm,
        trim_top_mm: body.trim_top_mm,
        trim_right_mm: body.trim_right_mm,
        trim_bottom_mm: body.trim_bottom_mm,
        trim_left_mm: body.trim_left_mm,
        rotatable: body.rotatable,
        waste_multi: body.waste_multi,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'material_id'
      })
      .select()
      .single()

    if (settingsError) {
      console.error('Supabase error:', settingsError)
      return NextResponse.json({ 
        error: 'Failed to update material settings', 
        details: settingsError.message,
        code: settingsError.code
      }, { status: 500 })
    }

    // Update the machine_material_map table
    if (body.machine_code) {
      const { data: machineData, error: machineError } = await supabase
        .from('machine_material_map')
        .upsert({
          material_id: id,
          machine_type: 'Korpus',
          machine_code: body.machine_code,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'material_id,machine_type'
        })
        .select()
        .single()

      if (machineError) {
        console.error('Supabase error:', machineError)
        return NextResponse.json({ 
          error: 'Failed to update machine mapping', 
          details: machineError.message,
          code: machineError.code
        }, { status: 500 })
      }
    }

    console.log(`Material updated successfully: ${body.name}`)
    
    return NextResponse.json({
      success: true,
      message: 'Material updated successfully',
      data: { material: materialData, settings: settingsData }
    })
  } catch (error) {
    console.error('Error updating material:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete material
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Soft deleting material ${id}`)

    // Try soft delete first
    let { error } = await supabase
      .from('materials')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    // If deleted_at column doesn't exist, fall back to hard delete
    if (error && error.message.includes('column "deleted_at" does not exist')) {
      console.log('deleted_at column not found, using hard delete...')

      const result = await supabase
        .from('materials')
        .delete()
        .eq('id', id)

      error = result.error
    }

    if (error) {
      console.error('Supabase delete error:', error)
      return NextResponse.json({ error: 'Failed to delete material' }, { status: 500 })
    }

    console.log(`Material ${id} deleted successfully`)
    
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting material:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
