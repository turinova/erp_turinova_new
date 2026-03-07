import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'

/**
 * PUT /api/products/[id]/descriptions
 * Update product description
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { language_code, name, meta_title, meta_keywords, meta_description, short_description, description, parameters, measurement_unit, generation_instructions } = body

    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if description exists
    const { data: existingDesc } = await supabase
      .from('shoprenter_product_descriptions')
      .select('id')
      .eq('product_id', id)
      .eq('language_code', language_code || 'hu')
      .single()

    const descriptionData = {
      product_id: id,
      language_code: language_code || 'hu',
      name: name || '',
      meta_title: meta_title || null,
      meta_keywords: meta_keywords || null,
      meta_description: meta_description || null,
      short_description: short_description || null,
      description: description || null,
      parameters: parameters || null, // Add parameters field
      measurement_unit: measurement_unit || null, // Add measurement_unit field
      generation_instructions: generation_instructions || null,
      updated_at: new Date().toISOString()
    }

    let result
    if (existingDesc) {
      // Update existing
      result = await supabase
        .from('shoprenter_product_descriptions')
        .update(descriptionData)
        .eq('id', existingDesc.id)
        .select()
        .single()
    } else {
      // Create new
      result = await supabase
        .from('shoprenter_product_descriptions')
        .insert(descriptionData)
        .select()
        .single()
    }

    if (result.error) {
      console.error('Error saving description:', result.error)
      return NextResponse.json({ 
        success: false, 
        error: result.error.message 
      }, { status: 500 })
    }

    // Also update product name if it's the primary language
    if (language_code === 'hu' || !language_code) {
      await supabase
        .from('shoprenter_products')
        .update({ name: name || null })
        .eq('id', id)
    }

    return NextResponse.json({ success: true, description: result.data })
  } catch (error) {
    console.error('Error updating description:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
