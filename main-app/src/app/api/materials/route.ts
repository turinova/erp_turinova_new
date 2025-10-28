import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { invalidateApiCache } from '@/hooks/useApiCache'

// GET /api/materials - List materials with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('q')
    
    console.log('Fetching materials...')
    const startTime = performance.now()
    
    let query = supabaseServer
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
        base_price,
        multiplier,
        price_per_sqm,
        created_at,
        updated_at,
        brands:brand_id(name),
        vat:vat_id(kulcs),
        partners:partners_id(name),
        units:units_id(name, shortform),
        material_settings!left(
          kerf_mm,
          trim_top_mm,
          trim_right_mm,
          trim_bottom_mm,
          trim_left_mm,
          rotatable,
          waste_multi,
          usage_limit
        )
      `)
      .is('deleted_at', null)
      .limit(50)
      .order('created_at', { ascending: false })
    
    // Add search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,brands.name.ilike.%${search}%`)
    }
    
    const { data, error } = await query
    
    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`Materials query took: ${queryTime.toFixed(2)}ms`)

    if (error) {
      console.error('Error fetching materials:', error)
      return NextResponse.json({ 
        success: false, 
        message: 'Failed to fetch materials',
        error: error.message 
      }, { status: 500 })
    }

    // Transform the data to match the expected format
    const transformedMaterials = data?.map(material => {
      // material_settings is now a single object, not an array
      const settings = material.material_settings
      const brandName = material.brands?.name || 'Unknown'
      const vatPercent = material.vat?.kulcs || 0
      const partnerName = material.partners?.name || null
      const unitName = material.units?.name || null
      const unitShortform = material.units?.shortform || null
      
      return {
        id: material.id,
        name: material.name,
        brand_name: brandName,
        material_name: material.name,
        length_mm: material.length_mm,
        width_mm: material.width_mm,
        thickness_mm: material.thickness_mm,
        grain_direction: material.grain_direction,
        on_stock: material.on_stock,
        active: material.active !== undefined ? material.active : true,
        image_url: material.image_url,
        kerf_mm: settings?.kerf_mm || 3,
        trim_top_mm: settings?.trim_top_mm || 10,
        trim_right_mm: settings?.trim_right_mm || 10,
        trim_bottom_mm: settings?.trim_bottom_mm || 10,
        trim_left_mm: settings?.trim_left_mm || 10,
        rotatable: settings?.rotatable ?? true,
        waste_multi: settings?.waste_multi || 1,
        usage_limit: settings?.usage_limit !== undefined && settings?.usage_limit !== null ? settings.usage_limit : 0.65,
        base_price: material.base_price || 0,
        multiplier: material.multiplier || 1.38,
        price_per_sqm: material.price_per_sqm || 0, // Keep for backward compatibility
        partner_name: partnerName,
        unit_name: unitName,
        unit_shortform: unitShortform,
        vat_percent: vatPercent,
        created_at: material.created_at,
        updated_at: material.updated_at
      }
    }) || []

    console.log(`Fetched ${transformedMaterials.length} materials successfully`)
    
    // Add cache control headers for dynamic ERP data
    const response = NextResponse.json(transformedMaterials)
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
  } catch (error) {
    console.error('Error in materials API:', error)
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST /api/materials - Create new material
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('Creating new material:', body)
    
    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Material name is required' }, { status: 400 })
    }
    if (!body.brand_id) {
      return NextResponse.json({ error: 'Brand is required' }, { status: 400 })
    }
    if (!body.currency_id) {
      return NextResponse.json({ error: 'Currency is required' }, { status: 400 })
    }
    if (!body.vat_id) {
      return NextResponse.json({ error: 'VAT is required' }, { status: 400 })
    }

    // Get current user
    const { data: { user } } = await supabaseServer.auth.getUser()
    
    // Insert into materials table
    const { data: materialData, error: materialError } = await supabaseServer
      .from('materials')
      .insert({
        name: body.name,
        brand_id: body.brand_id,
        length_mm: body.length_mm || 2800,
        width_mm: body.width_mm || 2070,
        thickness_mm: body.thickness_mm || 18,
        grain_direction: body.grain_direction || false,
        on_stock: body.on_stock !== undefined ? body.on_stock : true,
        active: body.active !== undefined ? body.active : true,
        image_url: body.image_url || null,
        base_price: body.base_price || 0,
        multiplier: body.multiplier || 1.38,
        partners_id: body.partners_id || null,
        units_id: body.units_id || null,
        currency_id: body.currency_id,
        vat_id: body.vat_id
      })
      .select()
      .single()

    if (materialError) {
      console.error('Error creating material:', materialError)
      return NextResponse.json({ error: 'Failed to create material', details: materialError.message }, { status: 500 })
    }

    const materialId = materialData.id
    console.log('Material created with ID:', materialId)

    // Insert into material_settings
    const { error: settingsError } = await supabaseServer
      .from('material_settings')
      .insert({
        material_id: materialId,
        kerf_mm: body.kerf_mm || 3,
        trim_top_mm: body.trim_top_mm || 10,
        trim_right_mm: body.trim_right_mm || 10,
        trim_bottom_mm: body.trim_bottom_mm || 10,
        trim_left_mm: body.trim_left_mm || 10,
        rotatable: body.rotatable !== undefined ? body.rotatable : true,
        waste_multi: body.waste_multi || 1.0,
        usage_limit: body.usage_limit || 0.65
      })

    if (settingsError) {
      console.error('Error creating material settings:', settingsError)
      // Don't fail - settings are optional
    }

    // Insert into machine_material_map if machine_code provided
    if (body.machine_code) {
      const { error: machineError } = await supabaseServer
        .from('machine_material_map')
        .insert({
          material_id: materialId,
          machine_type: 'Korpus',
          machine_code: body.machine_code
        })

      if (machineError) {
        console.error('Error creating machine mapping:', machineError)
        // Don't fail - machine mapping is optional
      }
    }

    console.log('Material created successfully:', materialData.name)
    
    return NextResponse.json({
      success: true,
      id: materialId
    })
  } catch (error) {
    console.error('Error in materials POST API:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}