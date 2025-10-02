import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

// GET - List all edge materials with optional search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchQuery = searchParams.get('q')
    
    console.log('Fetching edge materials...', searchQuery ? `with search: ${searchQuery}` : '')
    
    let query = supabaseServer
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
      .is('deleted_at', null)
    
    // Add search filtering if query parameter exists
    if (searchQuery) {
      query = query.or(`type.ilike.%${searchQuery}%,decor.ilike.%${searchQuery}%`)
    }
    
    const { data: edgeMaterials, error } = await query
      .order('type', { ascending: true })
      .order('decor', { ascending: true })

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to fetch edge materials' }, { status: 500 })
    }

    console.log(`Fetched ${edgeMaterials?.length || 0} edge materials successfully`)
    
    // Add cache control headers for dynamic ERP data
    const response = NextResponse.json(edgeMaterials || [])
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
    
  } catch (error) {
    console.error('Error fetching edge materials:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new edge material
export async function POST(request: NextRequest) {
  try {
    console.log('Creating new edge material...')
    
    const body = await request.json()
    console.log('Request body:', body)

    // Validate required fields
    if (!body.type) {
      return NextResponse.json({ error: 'Type is required' }, { status: 400 })
    }
    
    // Prepare data for insertion
    const newEdgeMaterial = {
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    console.log('Prepared edge material data:', newEdgeMaterial)
    console.log('Thickness value:', newEdgeMaterial.thickness, 'Type:', typeof newEdgeMaterial.thickness)
    
    const { data, error } = await supabaseServer
      .from('edge_materials')
      .insert([newEdgeMaterial])
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
        error: 'Failed to create edge material',
        details: error.message,
        code: error.code
      }, { status: 500 })
    }

    const edgeMaterialId = data.id
    console.log('Edge material created with ID:', edgeMaterialId)

    // Handle machine_code mapping if provided
    const machineCode = body.machine_code || ''
    
    if (machineCode.trim() || machineCode === '') {
      // Always create mapping (even if empty)
      await supabaseServer
        .from('machine_edge_material_map')
        .insert({
          edge_material_id: edgeMaterialId,
          machine_type: 'Korpus',
          machine_code: machineCode
        })
    }

    console.log('Edge material created successfully:', data)
    
    return NextResponse.json({
      success: true,
      message: 'Edge material created successfully',
      data: data
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating edge material:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
