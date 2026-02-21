import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCategoryById } from '@/lib/categories-server'

/**
 * GET /api/categories/[id]/descriptions
 * Get category descriptions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params
    
    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get category
    const category = await getCategoryById(categoryId)
    if (!category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    // Get descriptions
    const { data: descriptions, error } = await supabase
      .from('shoprenter_category_descriptions')
      .select('*')
      .eq('category_id', categoryId)
      .order('language_id')

    if (error) {
      console.error('[CATEGORY DESCRIPTIONS] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch descriptions' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      descriptions: descriptions || []
    })
  } catch (error: any) {
    console.error('[CATEGORY DESCRIPTIONS] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * PUT /api/categories/[id]/descriptions
 * Update category description
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: categoryId } = await params
    const body = await request.json()
    const { language_id, name, custom_title, meta_description, description } = body

    const cookieStore = await cookies()
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseAnonKey!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Default to Hungarian language_id if not provided
    const defaultLanguageId = 'bGFuZ3VhZ2UtbGFuZ3VhZ2VfaWQ9MQ=='
    const targetLanguageId = language_id || defaultLanguageId

    // Check if description exists
    const { data: existingDesc } = await supabase
      .from('shoprenter_category_descriptions')
      .select('id')
      .eq('category_id', categoryId)
      .eq('language_id', targetLanguageId)
      .single()

    let result
    if (existingDesc) {
      // Update existing - only update provided fields
      const updateData: any = {
        updated_at: new Date().toISOString()
      }
      if (name !== undefined) updateData.name = name || null
      if (custom_title !== undefined) updateData.custom_title = custom_title || null
      if (meta_description !== undefined) updateData.meta_description = meta_description || null
      if (description !== undefined) updateData.description = description || null

      result = await supabase
        .from('shoprenter_category_descriptions')
        .update(updateData)
        .eq('id', existingDesc.id)
        .select()
        .single()
    } else {
      // Create new - need shoprenter_id, generate a temporary one
      // Format: "manual-category-desc-{categoryId}-{languageId}"
      const tempShoprenterId = Buffer.from(`manual-category-desc-${categoryId}-${targetLanguageId}`).toString('base64')
      
      const descriptionData = {
        category_id: categoryId,
        language_id: targetLanguageId,
        shoprenter_id: tempShoprenterId,
        name: name || null,
        custom_title: custom_title || null,
        meta_description: meta_description || null,
        description: description || null,
        updated_at: new Date().toISOString()
      }

      result = await supabase
        .from('shoprenter_category_descriptions')
        .insert(descriptionData)
        .select()
        .single()
    }

    if (result.error) {
      console.error('[CATEGORY DESCRIPTIONS] Error saving:', result.error)
      return NextResponse.json({ 
        success: false, 
        error: result.error.message 
      }, { status: 500 })
    }

    // Also update category name if it's the primary language
    if (targetLanguageId === defaultLanguageId && name) {
      await supabase
        .from('shoprenter_categories')
        .update({ name: name })
        .eq('id', categoryId)
    }

    return NextResponse.json({ success: true, description: result.data })
  } catch (error) {
    console.error('[CATEGORY DESCRIPTIONS] Error updating:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
