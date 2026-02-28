import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * GET /api/products/[id]/tags
 * Get product tags for a specific language
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const languageCode = searchParams.get('language_code') || 'hu'

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

    // Get product tags
    const { data: tags, error: tagsError } = await supabase
      .from('product_tags')
      .select('*')
      .eq('product_id', id)
      .eq('language_code', languageCode)
      .is('deleted_at', null)
      .single()

    if (tagsError && tagsError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching product tags:', tagsError)
      return NextResponse.json({ error: 'Failed to fetch product tags' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      tags: tags || null
    })
  } catch (error) {
    console.error('Error in GET /api/products/[id]/tags:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/products/[id]/tags
 * Update or create product tags for a specific language
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { language_code = 'hu', tags } = body

    if (!tags || typeof tags !== 'string') {
      return NextResponse.json({ error: 'Tags must be a non-empty string' }, { status: 400 })
    }

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

    // Get product to get connection_id
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('connection_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check if tag entry already exists
    const { data: existingTag } = await supabase
      .from('product_tags')
      .select('*')
      .eq('product_id', id)
      .eq('language_code', language_code)
      .is('deleted_at', null)
      .single()

    const trimmedTags = tags.trim()
    console.log(`[TAGS API] PUT request - tags: "${tags}", trimmed: "${trimmedTags}", existingTag:`, existingTag ? existingTag.id : 'none')

    // If tags are empty, delete the entry (soft delete)
    if (trimmedTags.length === 0) {
      if (existingTag) {
        console.log(`[TAGS API] Deleting product tags with ID: ${existingTag.id}`)
        const { error: deleteError, data: deleteData } = await supabase
          .from('product_tags')
          .update({ deleted_at: new Date().toISOString() })
          .eq('id', existingTag.id)
          .select()

        if (deleteError) {
          console.error('[TAGS API] Error deleting product tags:', deleteError)
          return NextResponse.json({ error: 'Failed to delete product tags' }, { status: 500 })
        }

        console.log(`[TAGS API] Successfully deleted product tags. Updated rows:`, deleteData)
        
        // Verify deletion
        const { data: verifyTag } = await supabase
          .from('product_tags')
          .select('*')
          .eq('id', existingTag.id)
          .single()
        
        console.log(`[TAGS API] Verification after delete:`, verifyTag ? `deleted_at: ${verifyTag.deleted_at}` : 'not found')

        return NextResponse.json({
          success: true,
          message: 'Product tags deleted successfully'
        })
      } else {
        // No existing tags to delete
        console.log(`[TAGS API] No existing tags to delete`)
        return NextResponse.json({
          success: true,
          message: 'No product tags to delete'
        })
      }
    }

    // Tags are not empty - update or create
    const tagData = {
      product_id: id,
      connection_id: product.connection_id,
      language_code,
      tags: trimmedTags,
      deleted_at: null // Ensure it's not deleted
    }

    if (existingTag) {
      // Update existing tag entry
      const { error: updateError } = await supabase
        .from('product_tags')
        .update(tagData)
        .eq('id', existingTag.id)

      if (updateError) {
        console.error('Error updating product tags:', updateError)
        return NextResponse.json({ error: 'Failed to update product tags' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Product tags updated successfully'
      })
    } else {
      // Insert new tag entry
      const { error: insertError } = await supabase
        .from('product_tags')
        .insert(tagData)

      if (insertError) {
        console.error('Error inserting product tags:', insertError)
        return NextResponse.json({ error: 'Failed to insert product tags' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        message: 'Product tags created successfully'
      })
    }
  } catch (error) {
    console.error('Error in PUT /api/products/[id]/tags:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
