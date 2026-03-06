import { NextRequest, NextResponse } from 'next/server'
import { getTenantSupabase } from '@/lib/tenant-supabase'
import { getConnectionById } from '@/lib/connections-server'
import {
  extractShopNameFromUrl,
  getShopRenterAuthHeader
} from '@/lib/shoprenter-api'
import { Buffer } from 'buffer'

/**
 * GET /api/products/[id]/product-class
 * Get current Product Class for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get product
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
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const connection = (product as any).webshop_connections
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Fetch Product Class from ShopRenter
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json(
        { error: 'Invalid API URL format' },
        { status: 400 }
      )
    }

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username || '',
      connection.password || '',
      connection.api_url
    )

    // Fetch productExtend to get Product Class
    const productExtendUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}?full=1`
    const response = await fetch(productExtendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `ShopRenter API hiba: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const productClass = data.productClass

    if (!productClass) {
      return NextResponse.json({
        success: true,
        productClass: null
      })
    }

    // Extract Product Class ID
    let productClassId: string | null = null
    if (typeof productClass === 'object' && productClass.id) {
      productClassId = productClass.id
    } else if (productClass.href) {
      const hrefParts = productClass.href.split('/')
      productClassId = hrefParts[hrefParts.length - 1] || null
    }

    if (!productClassId) {
      return NextResponse.json({
        success: true,
        productClass: null
      })
    }

    // Fetch Product Class details from database (synced from ShopRenter)
    const connectionId = (product as any).connection_id || connection.id
    const { data: productClassData } = await supabase
      .from('shoprenter_product_classes')
      .select('id, shoprenter_id, name, description')
      .eq('connection_id', connectionId)
      .eq('shoprenter_id', productClassId)
      .is('deleted_at', null)
      .single()

    let productClassName: string | null = null
    if (productClassData) {
      productClassName = productClassData.name || null
    } else {
      // If not in database, try to fetch from ShopRenter API as fallback
      console.warn(`[PRODUCT-CLASS] Product Class ${productClassId} not found in database, fetching from ShopRenter API`)
      const classUrl = `${apiBaseUrl}/productClasses/${productClassId}?full=1`
      const classResponse = await fetch(classUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        signal: AbortSignal.timeout(10000)
      })

      if (classResponse.ok) {
        const classData = await classResponse.json()
        productClassName = classData.name || null
      }
    }

    return NextResponse.json({
      success: true,
      productClass: {
        id: productClassId,
        name: productClassName
      }
    })
  } catch (error: any) {
    console.error('Error in product-class GET route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/products/[id]/product-class
 * Update Product Class for a product
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await getTenantSupabase()

    // Get auth user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { productClassId } = body

    if (!productClassId) {
      return NextResponse.json(
        { error: 'productClassId is required' },
        { status: 400 }
      )
    }

    // Get product
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
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const connection = (product as any).webshop_connections
    if (!connection || connection.connection_type !== 'shoprenter') {
      return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
    }

    // Update Product Class in ShopRenter
    const shopName = extractShopNameFromUrl(connection.api_url)
    if (!shopName) {
      return NextResponse.json(
        { error: 'Invalid API URL format' },
        { status: 400 }
      )
    }

    const { authHeader, apiBaseUrl } = await getShopRenterAuthHeader(
      shopName,
      connection.username || '',
      connection.password || '',
      connection.api_url
    )

    // Update via productExtend
    const productExtendUrl = `${apiBaseUrl}/productExtend/${product.shoprenter_id}`
    const updateResponse = await fetch(productExtendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        productClass: {
          id: productClassId
        }
      }),
      signal: AbortSignal.timeout(10000)
    })

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text()
      console.error(`[PRODUCT-CLASS] ShopRenter API error: ${updateResponse.status} - ${errorText}`)
      return NextResponse.json(
        { 
          error: `ShopRenter API hiba (${updateResponse.status}): ${errorText.substring(0, 200)}` 
        },
        { status: updateResponse.status }
      )
    }

    // Fetch Product Class name for response
    const classUrl = `${apiBaseUrl}/productClasses/${productClassId}?full=1`
    const classResponse = await fetch(classUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader
      },
      signal: AbortSignal.timeout(10000)
    })

    let productClassName: string | null = null
    if (classResponse.ok) {
      const classData = await classResponse.json()
      productClassName = classData.name || null
    }

    // Clear product attributes since Product Class changed
    // Different Product Classes have different attributes, so old attributes are invalid
    // ShopRenter will remove invalid relations on next sync, but we clear locally immediately
    const currentAttributes = (product.product_attributes as any[]) || []
    const attributeCount = currentAttributes.length

    // Update product: clear attributes, update product_class_shoprenter_id, and set sync status to pending
    await supabase
      .from('shoprenter_products')
      .update({ 
        product_class_shoprenter_id: productClassId, // Update Product Class ID so available attributes endpoint works
        product_attributes: [], // Clear all attributes
        sync_status: 'pending',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    // Build message based on whether attributes were cleared
    let message = 'Termék típusa frissítve.'
    if (attributeCount > 0) {
      message += ` A korábbi attribútumok (${attributeCount} db) törölve lettek, mivel az új termék típus más attribútumokat tartalmaz.`
    }
    message += ' A változások szinkronizálása szükséges.'

    return NextResponse.json({
      success: true,
      productClass: {
        id: productClassId,
        name: productClassName
      },
      message: message,
      attributesCleared: attributeCount > 0,
      attributeCount: attributeCount
    })
  } catch (error: any) {
    console.error('Error in product-class PUT route:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
