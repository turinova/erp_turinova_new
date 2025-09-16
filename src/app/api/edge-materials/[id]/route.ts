import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side Supabase client with service role key
function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== EDGE MATERIAL GET API START ===')
    const { id } = await params
    console.log('Edge material ID:', id)
    console.log('ID type:', typeof id)
    console.log('ID length:', id?.length)
    
    const supabase = createServerClient()
    console.log('Using server-side supabase client')
    
    console.log('Querying edge_materials table...')
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

    console.log('Supabase query completed')
    console.log('Data:', data)
    console.log('Error:', error)

    if (error) {
      console.error('=== SUPABASE ERROR DETAILS ===')
      console.error('Error message:', error.message)
      console.error('Error code:', error.code)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      console.error('Full error object:', JSON.stringify(error, null, 2))
      
      // Check if it's a "not found" error vs other database errors
      if (error.code === 'PGRST116' || error.message.includes('No rows found')) {
        return NextResponse.json({ 
          error: 'Edge material not found', 
          details: error.message,
          code: error.code,
          hint: error.hint
        }, { status: 404 })
      } else {
        // Other database errors should return 500
        return NextResponse.json({ 
          error: 'Database error', 
          details: error.message,
          code: error.code,
          hint: error.hint
        }, { status: 500 })
      }
    }

    console.log('=== SUCCESS ===')
    console.log('Fetched edge material:', JSON.stringify(data, null, 2))
    return NextResponse.json(data)
  } catch (error) {
    console.error('=== CATCH BLOCK ERROR ===')
    console.error('Error type:', typeof error)
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error')
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('Full error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== EDGE MATERIAL PUT API START ===')
    const { id } = await params
    console.log('Edge material ID:', id)
    console.log('ID type:', typeof id)
    
    const body = await request.json()
    console.log('Request body:', JSON.stringify(body, null, 2))
    console.log('Body keys:', Object.keys(body))
    console.log('Body values:', Object.values(body))
    
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
    const supabase = createServerClient()
    console.log('Using server-side supabase client')
    
    console.log('Updating edge_materials table...')
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

    console.log('Supabase update completed')
    console.log('Data:', data)
    console.log('Error:', error)

    if (error) {
      console.error('=== SUPABASE UPDATE ERROR DETAILS ===')
      console.error('Error message:', error.message)
      console.error('Error code:', error.code)
      console.error('Error details:', error.details)
      console.error('Error hint:', error.hint)
      console.error('Full error object:', JSON.stringify(error, null, 2))
      
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

    console.log('=== UPDATE SUCCESS ===')
    console.log('Updated edge material:', JSON.stringify(data, null, 2))
    return NextResponse.json({
      success: true,
      message: 'Edge material updated successfully',
      data: data
    })
  } catch (error) {
    console.error('=== PUT CATCH BLOCK ERROR ===')
    console.error('Error type:', typeof error)
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error')
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack')
    console.error('Full error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    console.log('Deleting edge material with ID:', id)
    
    const supabase = createServerClient()
    console.log('Using server-side supabase client')
    
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
    return NextResponse.json({ 
      success: true,
      message: 'Edge material deleted successfully' 
    })
  } catch (error) {
    console.error('Error in edge material DELETE API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
