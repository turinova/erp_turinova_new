import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withCache, cacheTTL } from '@/lib/api-cache'

export async function GET(request: NextRequest) {
  try {
    console.log('Fetching edge materials (optimized with caching)...')
    
    const startTime = performance.now()
    
    // Use caching for better performance
    const edgeMaterials = await withCache(
      'edge-materials-list',
      async () => {
        const { data, error } = await supabase
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
          .order('type', { ascending: true })
          .order('decor', { ascending: true })

        if (error) {
          console.error('Supabase error:', error)
          throw new Error(`Database error: ${error.message}`)
        }

        return data || []
      },
      cacheTTL.medium // 15 minutes cache
    )

    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`Edge materials query took: ${queryTime.toFixed(2)}ms`)
    console.log(`Fetched ${edgeMaterials?.length || 0} edge materials successfully`)

    return NextResponse.json(edgeMaterials)
  } catch (error) {
    console.error('Error in optimized edge materials API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Creating new edge material (optimized)...')
    
    const body = await request.json()
    console.log('Request body:', JSON.stringify(body, null, 2))
    
    // Prepare data for insertion - exclude nested objects
    const newEdgeMaterial = {
      brand_id: body.brand_id || '',
      type: body.type || '',
      thickness: parseFloat(body.thickness) || 0,
      width: parseFloat(body.width) || 0,
      decor: body.decor || '',
      price: parseFloat(body.price) || 0,
      vat_id: body.vat_id || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    console.log('Prepared data for insertion:', JSON.stringify(newEdgeMaterial, null, 2))
    
    const { data, error } = await supabase
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
      console.error('Error details:', JSON.stringify(error, null, 2))
      
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

    console.log('Edge material created successfully:', data)
    
    // Invalidate cache after successful creation
    const { apiCache } = await import('@/lib/api-cache')
    apiCache.invalidate('edge-materials-list')
    
    return NextResponse.json({
      success: true,
      message: 'Edge material created successfully',
      data: data
    }, { status: 201 })
  } catch (error) {
    console.error('Error in optimized edge materials POST API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
