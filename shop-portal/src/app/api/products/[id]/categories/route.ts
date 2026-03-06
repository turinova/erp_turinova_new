import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // Get tenant-aware Supabase client - CRITICAL: No fallback to default database
    const supabase = await getTenantSupabase()

    const { data: relations, error } = await supabase
      .from('shoprenter_product_category_relations')
      .select(`
        category_id,
        shoprenter_categories(
          id,
          name,
          url_slug,
          category_url,
          shoprenter_category_descriptions(name, description)
        )
      `)
      .eq('product_id', id)
      .is('deleted_at', null)

    if (error) {
      console.error('[API] Error fetching categories for product:', error)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    // Extract categories from relations
    const categories = (relations || [])
      .map(rel => rel.shoprenter_categories)
      .filter(Boolean)

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('[API] Error in categories route:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/products/[id]/categories?categoryId=xxx
 * Remove a category from a product
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // Get categoryId from query parameters
    const url = new URL(request.url)
    const categoryId = url.searchParams.get('categoryId')
    
    if (!categoryId) {
      return NextResponse.json({ error: 'Category ID is required' }, { status: 400 })
    }
    
    return await deleteCategoryRelation(id, categoryId)
  } catch (error) {
    console.error('[API] Error deleting category from product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function deleteCategoryRelation(productId: string, categoryId: string) {
  const supabase = await getTenantSupabase()

  // Verify user is authenticated
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Soft delete the relation
  const { error } = await supabase
    .from('shoprenter_product_category_relations')
    .update({ deleted_at: new Date().toISOString() })
    .eq('product_id', productId)
    .eq('category_id', categoryId)
    .is('deleted_at', null)

  if (error) {
    console.error('[API] Error deleting category relation:', error)
    return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

/**
 * POST /api/products/[id]/categories
 * Add categories to a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { categoryIds } = body

    if (!categoryIds || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return NextResponse.json({ error: 'Category IDs array is required' }, { status: 400 })
    }

    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product to find connection_id and shoprenter_id
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select('connection_id, shoprenter_id')
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    if (!product.shoprenter_id) {
      return NextResponse.json({ error: 'Product does not have a ShopRenter ID' }, { status: 400 })
    }

    // Get existing relations to avoid duplicates (including soft-deleted ones to check shoprenter_id)
    const { data: existingRelations } = await supabase
      .from('shoprenter_product_category_relations')
      .select('id, category_id, shoprenter_id, deleted_at')
      .eq('product_id', id)

    const existingCategoryIds = new Set((existingRelations || [])
      .filter(r => !r.deleted_at)
      .map(r => r.category_id))
    const newCategoryIds = categoryIds.filter(catId => !existingCategoryIds.has(catId))

    if (newCategoryIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'All categories are already assigned',
        added: 0 
      })
    }

    // Get categories to verify they exist and get shoprenter_id
    const { data: categories, error: categoriesError } = await supabase
      .from('shoprenter_categories')
      .select('id, shoprenter_id, connection_id')
      .in('id', newCategoryIds)
      .is('deleted_at', null)

    if (categoriesError || !categories || categories.length === 0) {
      return NextResponse.json({ error: 'Categories not found' }, { status: 404 })
    }

    // Verify all categories belong to the same connection as the product
    const invalidCategories = categories.filter(cat => cat.connection_id !== product.connection_id)
    if (invalidCategories.length > 0) {
      return NextResponse.json({ 
        error: 'Some categories do not belong to the same connection as the product' 
      }, { status: 400 })
    }

    // Create relations - check for existing shoprenter_id to avoid duplicates
    const relationsToInsert: any[] = []
    const relationsToRestore: any[] = []

    for (const cat of categories) {
      const generatedShoprenterId = `product-${product.shoprenter_id}-category-${cat.shoprenter_id}`
      
      // First check if relation with this category_id already exists (active)
      const existingByCategory = existingRelations?.find(r => r.category_id === cat.id && !r.deleted_at)
      if (existingByCategory) {
        // Already assigned, skip
        continue
      }
      
      // Check if relation with this shoprenter_id already exists (even if soft-deleted)
      const existingByShoprenterId = existingRelations?.find(r => r.shoprenter_id === generatedShoprenterId)
      
      if (existingByShoprenterId) {
        if (existingByShoprenterId.deleted_at) {
          // Restore soft-deleted relation
          relationsToRestore.push({
            id: existingByShoprenterId.id,
            category_id: cat.id,
            shoprenter_id: generatedShoprenterId
          })
        }
        // If not deleted, skip (already exists)
      } else {
        // Check if there's a relation with same category but different shoprenter_id (shouldn't happen, but handle it)
        const existingByCategoryDeleted = existingRelations?.find(r => r.category_id === cat.id && r.deleted_at)
        if (existingByCategoryDeleted) {
          // Update the existing relation with new shoprenter_id and restore it
          relationsToRestore.push({
            id: existingByCategoryDeleted.id,
            category_id: cat.id,
            shoprenter_id: generatedShoprenterId
          })
        } else {
          // Create new relation
          relationsToInsert.push({
            product_id: id,
            category_id: cat.id,
            connection_id: product.connection_id,
            shoprenter_id: generatedShoprenterId,
            product_shoprenter_id: product.shoprenter_id,
            category_shoprenter_id: cat.shoprenter_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        }
      }
    }

    // Restore soft-deleted relations
    if (relationsToRestore.length > 0) {
      for (const restore of relationsToRestore) {
        if (restore.id) {
          const updateData: any = {
            deleted_at: null,
            category_id: restore.category_id,
            updated_at: new Date().toISOString()
          }
          
          // Update shoprenter_id if it changed
          if (restore.shoprenter_id) {
            updateData.shoprenter_id = restore.shoprenter_id
          }
          
          await supabase
            .from('shoprenter_product_category_relations')
            .update(updateData)
            .eq('id', restore.id)
        }
      }
    }

    // Insert new relations
    let insertError = null
    if (relationsToInsert.length > 0) {
      const { error } = await supabase
        .from('shoprenter_product_category_relations')
        .insert(relationsToInsert)
      insertError = error
    }

    if (insertError) {
      console.error('[API] Error inserting category relations:', insertError)
      return NextResponse.json({ error: 'Failed to add categories' }, { status: 500 })
    }

    const totalAdded = relationsToInsert.length + relationsToRestore.length

    return NextResponse.json({ 
      success: true, 
      added: totalAdded,
      message: `${totalAdded} kategória hozzáadva${relationsToRestore.length > 0 ? ` (${relationsToRestore.length} visszaállítva)` : ''}`
    })
  } catch (error) {
    console.error('[API] Error adding categories to product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
