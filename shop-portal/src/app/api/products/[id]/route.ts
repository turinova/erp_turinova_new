import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'

/**
 * GET /api/products/[id]
 * Get a single product by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: product, error } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        descriptions:shoprenter_product_descriptions(*)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/products/[id]
 * Update a product's basic fields (sku, model_number, status, etc.)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow updating specific fields
    const allowedFields = ['sku', 'model_number', 'gtin', 'brand', 'manufacturer_id', 'status', 'name', 'price', 'cost', 'multiplier', 'multiplier_lock', 'competitor_tracking_enabled']
    const updateData: Record<string, any> = {}
    
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Update the product
    const { data: product, error } = await supabase
      .from('shoprenter_products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating product:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, product })
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/products/[id]
 * Soft delete a product (set deleted_at) and disable it in ShopRenter (status = 0)
 * Also disables all child products (variants) if any exist
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product with connection info
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        webshop_connections(*)
      `)
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found or already deleted' }, { status: 404 })
    }

    // Check if product has children (variants)
    const { data: children, error: childrenError } = await supabase
      .from('shoprenter_products')
      .select('id, sku, name')
      .eq('parent_product_id', id)
      .is('deleted_at', null)

    const childCount = children?.length || 0
    const childProducts = children || []

    // Soft delete the product in ERP
    const { error: deleteError } = await supabase
      .from('shoprenter_products')
      .update({
        deleted_at: new Date().toISOString(),
        sync_status: 'pending' // Mark for sync to ShopRenter
      })
      .eq('id', id)

    if (deleteError) {
      console.error('Error soft deleting product:', deleteError)
      return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
    }

    // Soft delete all child products (variants)
    let disabledChildrenCount = 0
    if (childCount > 0) {
      const childIds = childProducts.map(c => c.id)
      const { error: childrenDeleteError } = await supabase
        .from('shoprenter_products')
        .update({
          deleted_at: new Date().toISOString(),
          sync_status: 'pending'
        })
        .in('id', childIds)

      if (childrenDeleteError) {
        console.error('Error soft deleting child products:', childrenDeleteError)
        // Don't fail the entire operation, but log the error
      } else {
        disabledChildrenCount = childCount
      }
    }

    // If product is synced to ShopRenter, disable it there (status = 0)
    const connection = product.webshop_connections
    if (connection && connection.connection_type === 'shoprenter' && product.shoprenter_id && !product.shoprenter_id.startsWith('pending-')) {
      try {
        const shopName = extractShopNameFromUrl(connection.api_url)
        if (shopName) {
          const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
            shopName,
            connection.username,
            connection.password,
            connection.api_url
          )

          // Disable product in ShopRenter (status = 0)
          const disableResponse = await fetch(`${apiBaseUrl}/products/${product.shoprenter_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              status: '0' // Disabled
            }),
            signal: AbortSignal.timeout(10000)
          })

          if (!disableResponse.ok) {
            const errorText = await disableResponse.text().catch(() => 'Unknown error')
            console.warn(`[DELETE] Failed to disable product in ShopRenter: ${disableResponse.status} - ${errorText}`)
            // Don't fail the operation, product is already soft-deleted in ERP
          } else {
            console.log(`[DELETE] Product disabled in ShopRenter: ${product.shoprenter_id}`)
          }

          // Disable all child products in ShopRenter
          if (disabledChildrenCount > 0) {
            for (const child of childProducts) {
              // Get child product's shoprenter_id
              const { data: childProduct } = await supabase
                .from('shoprenter_products')
                .select('shoprenter_id')
                .eq('id', child.id)
                .single()

              if (childProduct?.shoprenter_id && !childProduct.shoprenter_id.startsWith('pending-')) {
                const childDisableResponse = await fetch(`${apiBaseUrl}/products/${childProduct.shoprenter_id}`, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader
                  },
                  body: JSON.stringify({
                    status: '0' // Disabled
                  }),
                  signal: AbortSignal.timeout(10000)
                })

                if (!childDisableResponse.ok) {
                  console.warn(`[DELETE] Failed to disable child product ${child.sku} in ShopRenter`)
                }
              }
            }
          }
        }
      } catch (shoprenterError) {
        console.error('[DELETE] Error disabling product in ShopRenter:', shoprenterError)
        // Don't fail the operation, product is already soft-deleted in ERP
      }
    }

    return NextResponse.json({
      success: true,
      message: childCount > 0
        ? `Termék törölve. ${disabledChildrenCount} variáns is letiltva.`
        : 'Termék törölve.',
      deletedProduct: {
        id: product.id,
        sku: product.sku,
        name: product.name
      },
      disabledChildren: disabledChildrenCount > 0 ? childProducts.map(c => ({ id: c.id, sku: c.sku, name: c.name })) : []
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/products/[id]/restore
 * Restore a soft-deleted product (set deleted_at = NULL) and enable it in ShopRenter (status = 1)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product (including soft-deleted ones)
    const { data: product, error: productError } = await supabase
      .from('shoprenter_products')
      .select(`
        *,
        webshop_connections(*)
      `)
      .eq('id', id)
      .single()

    if (productError || !product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Check if product is actually soft-deleted
    if (!product.deleted_at) {
      return NextResponse.json({ error: 'Product is not deleted' }, { status: 400 })
    }

    // Restore the product in ERP (set deleted_at = NULL)
    const { error: restoreError } = await supabase
      .from('shoprenter_products')
      .update({
        deleted_at: null,
        sync_status: 'pending' // Mark for sync to ShopRenter
      })
      .eq('id', id)

    if (restoreError) {
      console.error('Error restoring product:', restoreError)
      return NextResponse.json({ error: 'Failed to restore product' }, { status: 500 })
    }

    // If product is synced to ShopRenter, enable it there (status = 1)
    const connection = product.webshop_connections
    if (connection && connection.connection_type === 'shoprenter' && product.shoprenter_id && !product.shoprenter_id.startsWith('pending-')) {
      try {
        const shopName = extractShopNameFromUrl(connection.api_url)
        if (shopName) {
          const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
            shopName,
            connection.username,
            connection.password,
            connection.api_url
          )

          // Enable product in ShopRenter (status = 1)
          const enableResponse = await fetch(`${apiBaseUrl}/products/${product.shoprenter_id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              status: '1' // Enabled
            }),
            signal: AbortSignal.timeout(10000)
          })

          if (!enableResponse.ok) {
            const errorText = await enableResponse.text().catch(() => 'Unknown error')
            console.warn(`[RESTORE] Failed to enable product in ShopRenter: ${enableResponse.status} - ${errorText}`)
            // Don't fail the operation, product is already restored in ERP
          } else {
            console.log(`[RESTORE] Product enabled in ShopRenter: ${product.shoprenter_id}`)
          }
        }
      } catch (shoprenterError) {
        console.error('[RESTORE] Error enabling product in ShopRenter:', shoprenterError)
        // Don't fail the operation, product is already restored in ERP
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Termék visszaállítva',
      restoredProduct: {
        id: product.id,
        sku: product.sku,
        name: product.name
      }
    })
  } catch (error) {
    console.error('Error restoring product:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
