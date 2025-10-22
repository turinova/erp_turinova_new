import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// GET - Get single material
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    console.log(`Fetching material ${id}`)

    // Fetch material from materials table with pricing data
    const { data: materialData, error } = await supabase
      .from('materials')
      .select(`
        id,
        name,
        length_mm,
        width_mm,
        thickness_mm,
        grain_direction,
        on_stock,
        active,
        image_url,
        brand_id,
        base_price,
        multiplier,
        price_per_sqm,
        partners_id,
        units_id,
        currency_id,
        vat_id,
        created_at,
        updated_at,
        brands(id, name),
        currencies(id, name),
        vat(id, name, kulcs)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Supabase error:', error)
      
      if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
        return NextResponse.json({ error: 'Material not found' }, { status: 404 })
      }
      
      return NextResponse.json({ error: 'Failed to fetch material' }, { status: 500 })
    }

    if (!materialData) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 })
    }

    // Fetch settings from material_settings
    const { data: settingsData } = await supabase
      .from('material_settings')
      .select('kerf_mm, trim_top_mm, trim_right_mm, trim_bottom_mm, trim_left_mm, rotatable, waste_multi, usage_limit')
      .eq('material_id', id)
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
      id: materialData.id,
      name: materialData.name || `Material ${materialData.id}`,
      length_mm: materialData.length_mm || 2800,
      width_mm: materialData.width_mm || 2070,
      thickness_mm: materialData.thickness_mm || 18,
      grain_direction: Boolean(materialData.grain_direction),
      on_stock: materialData.on_stock !== undefined ? Boolean(materialData.on_stock) : true,
      active: materialData.active !== undefined ? Boolean(materialData.active) : true,
      image_url: materialData.image_url || null,
      brand_id: materialData.brand_id || '',
      brand_name: materialData.brands?.name || 'Unknown',
      kerf_mm: settingsData?.kerf_mm || 3,
      trim_top_mm: settingsData?.trim_top_mm || 0,
      trim_right_mm: settingsData?.trim_right_mm || 0,
      trim_bottom_mm: settingsData?.trim_bottom_mm || 0,
      trim_left_mm: settingsData?.trim_left_mm || 0,
      rotatable: settingsData?.rotatable !== false,
      waste_multi: settingsData?.waste_multi || 1.0,
      usage_limit: settingsData?.usage_limit || 0.65,
      machine_code: machineData?.machine_code || '',
      // Pricing fields
      base_price: materialData.base_price || 0,
      multiplier: materialData.multiplier || 1.38,
      price_per_sqm: materialData.price_per_sqm || 0,
      partners_id: materialData.partners_id || null,
      units_id: materialData.units_id || null,
      currency_id: materialData.currency_id || null,
      vat_id: materialData.vat_id || null,
      currencies: materialData.currencies || null,
      vat: materialData.vat || null,
      created_at: materialData.created_at,
      updated_at: materialData.updated_at
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
    
    // FIRST: Get current material to check if price changed
    const { data: currentMaterial } = await supabase
      .from('materials')
      .select('price_per_sqm')
      .eq('id', id)
      .single()
    
    // Get current user for price history tracking using cookies
    const cookieStore = await cookies()
    const supabaseWithAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          }
        }
      }
    )
    
    const { data: { user } } = await supabaseWithAuth.auth.getUser()
    console.log('Current user for materials price history:', user?.id, user?.email)
    
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
        active: body.active,
        image_url: body.image_url || null,
        brand_id: body.brand_id,
        base_price: body.base_price,
        multiplier: body.multiplier,
        price_per_sqm: body.price_per_sqm,
        partners_id: body.partners_id || null,
        units_id: body.units_id || null,
        currency_id: body.currency_id,
        vat_id: body.vat_id,
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
        usage_limit: body.usage_limit,
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

    // Track price history if price changed
    if (currentMaterial && body.price_per_sqm !== undefined && currentMaterial.price_per_sqm !== body.price_per_sqm) {
      console.log(`Price changed from ${currentMaterial.price_per_sqm} to ${body.price_per_sqm}, logging to history`)
      
      const { error: historyError } = await supabase
        .from('material_price_history')
        .insert({
          material_id: id,
          old_price_per_sqm: currentMaterial.price_per_sqm,
          new_price_per_sqm: body.price_per_sqm,
          changed_by: user?.id || null
        })
      
      if (historyError) {
        console.error('Error logging price history:', historyError)
        // Don't fail the update if history logging fails
      } else {
        console.log('Price history logged successfully')
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
