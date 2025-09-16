import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { withCache, cacheTTL } from '@/lib/api-cache'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('Fetching edge material (optimized with caching):', id)
    
    const startTime = performance.now()
    
    // Use caching for individual edge material
    const edgeMaterial = await withCache(
      `edge-material-${id}`,
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
          .eq('id', id)
          .is('deleted_at', null)
          .single()

        if (error) {
          console.error('Supabase error:', error)
          throw new Error(`Database error: ${error.message}`)
        }

        return data
      },
      cacheTTL.long // 30 minutes cache for individual records
    )

    const endTime = performance.now()
    const queryTime = endTime - startTime
    
    console.log(`Edge material query took: ${queryTime.toFixed(2)}ms`)
    console.log('Fetched edge material:', JSON.stringify(edgeMaterial, null, 2))
    
    return NextResponse.json(edgeMaterial)
  } catch (error) {
    console.error('Error in optimized edge material GET:', error)
    return NextResponse.json({ 
      error: 'Edge material not found',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 404 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('Updating edge material (optimized):', id)
    
    const body = await request.json()
    console.log('Request body:', JSON.stringify(body, null, 2))
    
    // Prepare data for update - exclude nested objects and timestamps
    const updateData = {
      brand_id: body.brand_id || '',
      type: body.type || '',
      thickness: parseFloat(body.thickness) || 0,
      width: parseFloat(body.width) || 0,
      decor: body.decor || '',
      price: parseFloat(body.price) || 0,
      vat_id: body.vat_id || '',
      updated_at: new Date().toISOString()
    }
    
    console.log('Prepared update data:', JSON.stringify(updateData, null, 2))
    
    const { data, error } = await supabase
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
        error: 'Failed to update edge material', 
        details: error.message,
        code: error.code,
        hint: error.hint
      }, { status: 500 })
    }

    console.log('Edge material updated successfully:', data)
    
    // Invalidate caches after successful update
    const { apiCache } = await import('@/lib/api-cache')
    apiCache.invalidate(`edge-material-${id}`)
    apiCache.invalidate('edge-materials-list')
    
    return NextResponse.json({
      success: true,
      message: 'Edge material updated successfully',
      data: data
    })
  } catch (error) {
    console.error('Error in optimized edge material PUT:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('Deleting edge material (optimized):', id)
    
    // Soft delete by setting deleted_at timestamp
    const { error } = await supabase
      .from('edge_materials')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error deleting edge material:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: 'Failed to delete edge material' }, { status: 500 })
    }

    console.log('Edge material deleted successfully')
    
    // Invalidate caches after successful deletion
    const { apiCache } = await import('@/lib/api-cache')
    apiCache.invalidate(`edge-material-${id}`)
    apiCache.invalidate('edge-materials-list')
    
    return NextResponse.json({ 
      success: true,
      message: 'Edge material deleted successfully' 
    })
  } catch (error) {
    console.error('Error in optimized edge material DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
