import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'

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
